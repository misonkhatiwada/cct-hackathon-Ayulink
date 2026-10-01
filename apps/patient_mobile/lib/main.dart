import 'dart:async';
import 'package:flutter/material.dart';
import 'core/api_service.dart';
import 'l10n/app_localizations.dart';

void main() {
  runApp(const AyuLinkPatientApp());
}

class AyuLinkPatientApp extends StatefulWidget {
  const AyuLinkPatientApp({super.key});

  @override
  State<AyuLinkPatientApp> createState() => _AyuLinkPatientAppState();
}

class _AyuLinkPatientAppState extends State<AyuLinkPatientApp> {
  AyuLocale _locale = AyuLocale.en;
  ThemeMode _themeMode = ThemeMode.light;
  int _selectedIndex = 0;
  String? _subScreen; // 'doctor_detail', 'booking', 'appointment_detail', 'lab_booking', 'pharmacy', 'emergency', 'ayu_ai', 'health_id'

  final AyuLinkApiService _api = AyuLinkApiService();
  late Map<String, dynamic> _state;

  // Discovery & Filters
  String _searchQuery = '';
  bool _showHospitals = false;
  String _activeFilter = 'all';

  // Selected Entities
  Map<String, dynamic>? _selectedDoctor;
  Map<String, dynamic>? _selectedAppointment;

  // Booking Flow State
  String _selectedFamilyId = 'fam-myself';
  String _selectedSlotId = 'slot-suman-330';
  String _bookingStep = 'select'; // 'select', 'summary', 'esewa', 'confirmed'
  int _holdSecondsRemaining = 0;
  Timer? _holdTimer;
  Map<String, dynamic>? _esewaDraft;
  bool _busy = false;
  String? _errorMsg;

  // AI Assistant State
  final List<Map<String, String>> _aiMessages = [
    {
      'role': 'assistant',
      'text':
          'Namaste Mison! I am Ayu Assistant. Ask me to explain your CBC lab report, find a Heart Doctor (Cardiology), or explain your prescription in English, नेपाली, or Roman Nepali.',
    }
  ];
  final TextEditingController _aiController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _state = AyuLinkApiService.getOfflineFallbackSeed();
    _selectedDoctor = (_state['doctors'] as List).first as Map<String, dynamic>;
    _syncFromBackend();
    _api.connectSocket((updatedState) {
      if (mounted) {
        setState(() => _state = updatedState);
      }
    });
  }

  @override
  void dispose() {
    _holdTimer?.cancel();
    _aiController.dispose();
    super.dispose();
  }

  Future<void> _syncFromBackend() async {
    final data = await _api.fetchState();
    if (mounted) {
      setState(() {
        _state = data;
        final docs = (_state['doctors'] as List?) ?? [];
        if (docs.isNotEmpty && _selectedDoctor == null) {
          _selectedDoctor = Map<String, dynamic>.from(docs.first as Map);
        }
      });
    }
  }

  void _startHoldCountdown() {
    _holdTimer?.cancel();
    setState(() => _holdSecondsRemaining = 299);
    _holdTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_holdSecondsRemaining <= 1) {
        timer.cancel();
        setState(() => _holdSecondsRemaining = 0);
      } else {
        setState(() => _holdSecondsRemaining -= 1);
      }
    });
  }

  String _formatTimer(int sec) {
    final m = (sec ~/ 60).toString().padLeft(2, '0');
    final s = (sec % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  List<Map<String, dynamic>> _getList(String key) {
    final raw = _state[key];
    if (raw is List) {
      return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<void> _handleHoldSlot(String slotId) async {
    setState(() {
      _selectedSlotId = slotId;
      _errorMsg = null;
    });
    _startHoldCountdown();
    try {
      await _api.holdSlot(slotId: slotId);
      await _syncFromBackend();
    } catch (e) {
      setState(() => _errorMsg = e.toString());
    }
  }

  Future<void> _handleInitiateEsewa() async {
    final doc = _selectedDoctor ?? _getList('doctors').first;
    setState(() {
      _busy = true;
      _errorMsg = null;
    });
    try {
      final draft = await _api.initiateEsewaPayment(
        slotId: _selectedSlotId,
        doctorId: doc['id'].toString(),
        forFamilyMemberId: _selectedFamilyId,
      );
      setState(() {
        _esewaDraft = draft;
        _bookingStep = 'esewa';
      });
    } catch (e) {
      setState(() => _errorMsg = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _handleVerifyEsewa({bool simulateFailure = false}) async {
    if (_esewaDraft == null) return;
    final doc = _selectedDoctor ?? _getList('doctors').first;
    final esewaPayload = Map<String, dynamic>.from(_esewaDraft!['esewaPayload'] as Map);

    setState(() {
      _busy = true;
      _errorMsg = null;
    });
    try {
      final res = await _api.verifyEsewaPayment({
        'paymentId': _esewaDraft!['paymentId'],
        'transactionUuid': esewaPayload['transactionUuid'],
        'totalAmount': esewaPayload['totalAmount'],
        'productCode': esewaPayload['productCode'],
        'signature': simulateFailure ? 'INVALID_SIG' : esewaPayload['signature'],
        'esewaStatus': simulateFailure ? 'FAILED' : 'COMPLETE',
        'slotId': _selectedSlotId,
        'doctorId': doc['id'],
        'patientId': 'pat-mison',
        'forFamilyMemberId': _selectedFamilyId,
      });
      _holdTimer?.cancel();
      await _syncFromBackend();
      setState(() {
        _selectedAppointment = Map<String, dynamic>.from(res['appointment'] as Map);
        _bookingStep = 'confirmed';
      });
    } catch (e) {
      _holdTimer?.cancel();
      await _syncFromBackend();
      setState(() {
        _bookingStep = 'select';
        _errorMsg = e.toString();
      });
    } finally {
      setState(() => _busy = false);
    }
  }

  void _showServerConfigDialog(BuildContext ctx) {
    final ctrl = TextEditingController(text: _api.baseUrl);
    showDialog(
      context: ctx,
      builder: (dCtx) => AlertDialog(
        title: const Text('Backend Server URL', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '• Web / iOS / Desktop: http://localhost:3000\n• Android Emulator: http://10.0.2.2:3000\n• Real Phone on Wi-Fi: http://<YOUR-PC-IP>:3000',
              style: TextStyle(fontSize: 12),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Node.js Server URL',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dCtx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              _api.setBaseUrl(ctrl.text, (updated) {
                if (mounted) setState(() => _state = updated);
              });
              _syncFromBackend();
              Navigator.pop(dCtx);
            },
            child: const Text('Connect & Sync'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = (String k) => AppStrings.tr(_locale, k);
    final misonAppointments = _getList('appointments')
        .where((a) => a['patientId'] == 'pat-mison')
        .toList();
    final calledApt = misonAppointments
        .where((a) => a['status'] == 'IN_CONSULTATION' || a['status'] == 'CALLED')
        .firstOrNull;

    return MaterialApp(
      title: 'AyuLink Patient OS',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF0D9488),
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF0D9488),
        brightness: Brightness.dark,
      ),
      home: Builder(
        builder: (ctx) => Scaffold(
          appBar: AppBar(
            leading: _subScreen != null
                ? IconButton(
                    icon: const Icon(Icons.arrow_back),
                    onPressed: () => setState(() {
                      _subScreen = null;
                      _bookingStep = 'select';
                    }),
                  )
                : null,
            title: Text(
              _subScreen != null ? _subScreen!.toUpperCase().replaceAll('_', ' ') : 'AYULINK',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            actions: [
              PopupMenuButton<AyuLocale>(
                initialValue: _locale,
                tooltip: 'Switch Language',
                onSelected: (val) => setState(() => _locale = val),
                itemBuilder: (_) => const [
                  PopupMenuItem(value: AyuLocale.en, child: Text('English (EN)')),
                  PopupMenuItem(value: AyuLocale.ne, child: Text('नेपाली (Nepali)')),
                  PopupMenuItem(value: AyuLocale.romanNe, child: Text('Roman Nepali')),
                ],
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Chip(
                    label: Text(
                      _locale == AyuLocale.en ? 'EN' : _locale == AyuLocale.ne ? 'नेपाली' : 'Roman',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Configure Backend URL',
                icon: const Icon(Icons.dns_outlined, size: 20),
                onPressed: () => _showServerConfigDialog(ctx),
              ),
              IconButton(
                icon: Icon(_themeMode == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode, size: 20),
                onPressed: () {
                  setState(() {
                    _themeMode = _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
                  });
                },
              ),
            ],
          ),
          body: Column(
            children: [
              if (calledApt != null)
                MaterialBanner(
                  backgroundColor: Colors.teal.shade700,
                  content: Text(
                    '🔔 YOUR TURN · Token ${calledApt['token']} · ${calledApt['roomNumber']} (${calledApt['doctorName']}) — Please proceed now!',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _selectedAppointment = calledApt;
                          _subScreen = 'appointment_detail';
                        });
                      },
                      child: const Text('OPEN', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _syncFromBackend,
                  child: _buildBody(ctx, t, misonAppointments),
                ),
              ),
            ],
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _selectedIndex,
            onDestinationSelected: (idx) {
              setState(() {
                _subScreen = null;
                _selectedIndex = idx;
              });
            },
            destinations: [
              NavigationDestination(icon: const Icon(Icons.home_outlined), label: t('navHome')),
              NavigationDestination(icon: const Icon(Icons.medical_services_outlined), label: t('navDoctors')),
              NavigationDestination(icon: const Icon(Icons.calendar_today_outlined), label: t('navAppointments')),
              NavigationDestination(icon: const Icon(Icons.timeline), label: t('navHealth')),
              NavigationDestination(icon: const Icon(Icons.person_outline), label: t('navProfile')),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    String Function(String) t,
    List<Map<String, dynamic>> misonAppointments,
  ) {
    if (_subScreen == 'doctor_detail') return _buildDoctorDetailScreen(t);
    if (_subScreen == 'booking') return _buildBookingScreen(t);
    if (_subScreen == 'appointment_detail') return _buildAppointmentDetailScreen(t);
    if (_subScreen == 'lab_booking') return _buildLabBookingScreen();
    if (_subScreen == 'pharmacy') return _buildPharmacyScreen();
    if (_subScreen == 'emergency' || _subScreen == 'health_id') return _buildEmergencyAndHealthIdScreen(t);
    if (_subScreen == 'ayu_ai') return _buildAyuAssistantScreen();

    switch (_selectedIndex) {
      case 0:
        return _buildHomeTab(t, misonAppointments);
      case 1:
        return _buildDiscoveryTab(t);
      case 2:
        return _buildAppointmentsTab(t, misonAppointments);
      case 3:
        return _buildHealthTimelineTab(t);
      case 4:
        return _buildProfileTab(t);
      default:
        return _buildHomeTab(t, misonAppointments);
    }
  }

  // ===========================================================================
  // TAB 1: HOME
  // ===========================================================================
  Widget _buildHomeTab(String Function(String) t, List<Map<String, dynamic>> misonAppointments) {
    final doctors = _getList('doctors');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t('greeting'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(t('howCanWeHelp'), style: const TextStyle(fontSize: 13, color: Colors.grey)),
                ],
              ),
            ),
            ActionChip(
              avatar: const Icon(Icons.qr_code, size: 16, color: Color(0xFF0D9488)),
              label: const Text('AL-NP-8F29K4', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
              onPressed: () => setState(() => _subScreen = 'health_id'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          children: [
            _QuickActionCard(
              icon: Icons.person_search,
              label: t('findDoctor'),
              onTap: () => setState(() {
                _showHospitals = false;
                _selectedIndex = 1;
              }),
            ),
            _QuickActionCard(
              icon: Icons.local_hospital,
              label: t('findHospital'),
              onTap: () => setState(() {
                _showHospitals = true;
                _selectedIndex = 1;
              }),
            ),
            _QuickActionCard(
              icon: Icons.science,
              label: t('bookLabTest'),
              onTap: () => setState(() => _subScreen = 'lab_booking'),
            ),
            _QuickActionCard(
              icon: Icons.medication,
              label: t('pharmacy'),
              onTap: () => setState(() => _subScreen = 'pharmacy'),
            ),
            _QuickActionCard(
              icon: Icons.videocam,
              label: t('telemedicine'),
              onTap: () => setState(() {
                _activeFilter = 'telemedicine';
                _selectedIndex = 1;
              }),
            ),
            _QuickActionCard(
              icon: Icons.emergency,
              label: t('emergency'),
              isEmergency: true,
              onTap: () => setState(() => _subScreen = 'emergency'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          t('upcomingAppointment'),
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
        ),
        const SizedBox(height: 8),
        if (misonAppointments.isNotEmpty)
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.teal.shade200),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'TODAY · ${misonAppointments.first['time']}',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0D9488)),
                      ),
                      Chip(
                        label: Text(
                          'Token: ${misonAppointments.first['token']}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    misonAppointments.first['doctorName'].toString(),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    '${misonAppointments.first['departmentName']} · ${misonAppointments.first['hospitalName']} · Status: ${misonAppointments.first['status']}',
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () {
                        setState(() {
                          _selectedAppointment = misonAppointments.first;
                          _subScreen = 'appointment_detail';
                        });
                      },
                      child: Text(t('viewAppointment')),
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.grey.shade300),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'RECOMMENDED · TODAY · 3:30 PM',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0D9488)),
                  ),
                  const SizedBox(height: 4),
                  const Text('Dr. Suman Sharma', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const Text('Cardiology · City Hospital · NPR 800 · ★★★★★ 4.8', style: TextStyle(fontSize: 12)),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () {
                        setState(() {
                          _selectedDoctor = doctors.first;
                          _subScreen = 'doctor_detail';
                        });
                      },
                      child: Text(t('bookAppointment')),
                    ),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 12),
        ListTile(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.teal.shade200),
          ),
          leading: const Icon(Icons.auto_awesome, color: Color(0xFF0D9488)),
          title: const Text('Ayu Assistant (AI Medical Guide)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          subtitle: const Text('Explain CBC lab reports, symptoms & medicines in EN / नेपाली', style: TextStyle(fontSize: 12)),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => setState(() => _subScreen = 'ayu_ai'),
        ),
      ],
    );
  }

  // ===========================================================================
  // TAB 2: DOCTORS & HOSPITALS DISCOVERY
  // ===========================================================================
  Widget _buildDiscoveryTab(String Function(String) t) {
    final doctors = _getList('doctors').where((d) {
      final q = _searchQuery.toLowerCase().trim();
      final isHeart = (q.contains('heart') || q.contains('cardio')) &&
          d['departmentName'].toString().toLowerCase().contains('cardio');
      final matchesQ = q.isEmpty ||
          isHeart ||
          d['name'].toString().toLowerCase().contains(q) ||
          d['specialty'].toString().toLowerCase().contains(q) ||
          d['departmentName'].toString().toLowerCase().contains(q);
      if (!matchesQ) return false;
      if (_activeFilter == 'telemedicine' && d['telemedicineAvailable'] != true) return false;
      return true;
    }).toList();

    final hospitals = _getList('hospitals');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          onChanged: (v) => setState(() => _searchQuery = v),
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.search),
            hintText: 'Search "Heart doctor", Cardiology, Hospital...',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              ActionChip(
                label: const Text('Search: "Heart doctor"'),
                onPressed: () => setState(() {
                  _showHospitals = false;
                  _searchQuery = 'Heart doctor';
                }),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('Doctors'),
                selected: !_showHospitals,
                onSelected: (_) => setState(() => _showHospitals = false),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('Hospitals'),
                selected: _showHospitals,
                onSelected: (_) => setState(() => _showHospitals = true),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (!_showHospitals)
          ...doctors.map(
            (doc) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: Colors.grey.shade300),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(doc['name'].toString(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Text(
                          'NPR ${doc['consultationFee']}',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0D9488)),
                        ),
                      ],
                    ),
                    Text('${doc['qualifications']} · ${doc['specialty']} · ${doc['experienceYears']} yrs exp',
                        style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 4),
                    Text('★★★★★ ${doc['rating']} · ${doc['hospitalName']} · Next: ${doc['nextAvailableText']}',
                        style: const TextStyle(fontSize: 12)),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () {
                          setState(() {
                            _selectedDoctor = doc;
                            _subScreen = 'doctor_detail';
                          });
                        },
                        child: const Text('View Doctor Profile & Book'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ...hospitals.map(
            (h) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: Colors.grey.shade300),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(h['name'].toString(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    Text('★★★★★ ${h['rating']} · ${h['city']}, ${h['district']} · ${h['distanceKm']} km',
                        style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 6),
                    const Text('Emergency ✓ · Lab ✓ · Pharmacy ✓ · Insurance ✓ · Telemedicine ✓',
                        style: TextStyle(fontSize: 12, color: Color(0xFF0D9488))),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => setState(() => _showHospitals = false),
                        child: const Text('View Hospital Doctors'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  // ===========================================================================
  // DOCTOR DETAIL SCREEN
  // ===========================================================================
  Widget _buildDoctorDetailScreen(String Function(String) t) {
    final doc = _selectedDoctor ?? _getList('doctors').first;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.grey.shade300),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(doc['nmcDemoBadge']?.toString() ?? 'DEMO-NMC',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF0D9488), fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text(doc['name'].toString(), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                Text('${doc['qualifications']} · ${doc['specialty']}', style: const TextStyle(fontSize: 13)),
                const SizedBox(height: 6),
                Text('★★★★★ ${doc['rating']} · ${doc['experienceYears']} Years Experience · ${doc['hospitalName']}',
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Consultation Fee', style: TextStyle(fontSize: 11, color: Colors.grey)),
                        Text('NPR ${doc['consultationFee']}',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('Next Available', style: TextStyle(fontSize: 11, color: Colors.grey)),
                        Text(doc['nextAvailableText'].toString(),
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0D9488))),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: FilledButton.icon(
            icon: const Icon(Icons.calendar_month),
            label: Text('${t('bookAppointment')} · NPR ${doc['consultationFee']}'),
            onPressed: () {
              setState(() {
                _bookingStep = 'select';
                _subScreen = 'booking';
              });
            },
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // BOOKING + SLOT HOLD (04:59) + ESEWA UAT VERIFICATION SCREEN
  // ===========================================================================
  Widget _buildBookingScreen(String Function(String) t) {
    final doc = _selectedDoctor ?? _getList('doctors').first;
    final family = _getList('familyMembers');
    final slots = _getList('slots').where((s) => s['doctorId'] == doc['id']).toList();
    final selectedFam = family.firstWhere(
      (f) => f['id'] == _selectedFamilyId,
      orElse: () => {'name': 'Mison Khatiwada', 'relation': 'Myself'},
    );

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.teal.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            'Appointment For: ${selectedFam['relation']} (${selectedFam['name']})',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
        ),
        if (_errorMsg != null) ...[
          const SizedBox(height: 10),
          Text(_errorMsg!, style: const TextStyle(color: Colors.red, fontSize: 12)),
        ],
        const SizedBox(height: 16),
        if (_bookingStep == 'select') ...[
          const Text('Who is this appointment for?', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: family.map((f) {
              final isSel = f['id'] == _selectedFamilyId;
              return ChoiceChip(
                label: Text('${f['relation']}'),
                selected: isSel,
                onSelected: (_) => setState(() => _selectedFamilyId = f['id'].toString()),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          const Text('Select Slot (October 1, 2026)', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: slots.map((slot) {
              final status = slot['status'].toString();
              final isBooked = status == 'CONFIRMED' || status == 'BLOCKED';
              final isSelected = _selectedSlotId == slot['id'];
              return OutlinedButton(
                style: OutlinedButton.styleFrom(
                  backgroundColor: isSelected ? const Color(0xFF0D9488) : null,
                  foregroundColor: isSelected ? Colors.white : null,
                ),
                onPressed: isBooked ? null : () => _handleHoldSlot(slot['id'].toString()),
                child: Text('${slot['time']} ($status)'),
              );
            }).toList(),
          ),
          if (_holdSecondsRemaining > 0) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.amber.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(t('slotHeld'), style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text('${t('expiresIn')} ${_formatTimer(_holdSecondsRemaining)}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton(
              onPressed: () {
                if (_holdSecondsRemaining == 0) {
                  _handleHoldSlot(_selectedSlotId);
                }
                setState(() => _bookingStep = 'summary');
              },
              child: const Text('Continue to Appointment Summary'),
            ),
          ),
        ] else if (_bookingStep == 'summary') ...[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('APPOINTMENT SUMMARY', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  const Divider(),
                  Text('Hospital: ${doc['hospitalName']}'),
                  Text('Department: ${doc['departmentName']}'),
                  Text('Doctor: ${doc['name']}'),
                  Text('Appointment For: ${selectedFam['relation']} (${selectedFam['name']})'),
                  Text('Fee: NPR ${doc['consultationFee']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF60BB46)),
              onPressed: _busy ? null : _handleInitiateEsewa,
              child: Text(_busy ? 'Initiating eSewa UAT...' : '${t('payEsewa')} · NPR ${doc['consultationFee']}'),
            ),
          ),
        ] else if (_bookingStep == 'esewa' && _esewaDraft != null) ...[
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Color(0xFF60BB46), width: 2),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('eSewa EPAYTEST (UAT Environment)',
                      style: TextStyle(color: Color(0xFF60BB46), fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('UUID: ${_esewaDraft!['esewaPayload']['transactionUuid']}', style: const TextStyle(fontSize: 12)),
                  Text('Product Code: ${_esewaDraft!['esewaPayload']['productCode']}', style: const TextStyle(fontSize: 12)),
                  Text('Amount: NPR ${_esewaDraft!['esewaPayload']['totalAmount']}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Text('HMAC-SHA256 Signature:\n${_esewaDraft!['esewaPayload']['signature']}',
                      style: const TextStyle(fontSize: 10, color: Colors.grey)),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFF60BB46)),
                      onPressed: _busy ? null : () => _handleVerifyEsewa(simulateFailure: false),
                      child: Text(_busy ? 'Verifying on Backend...' : 'Authorize eSewa UAT & Verify'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _busy ? null : () => _handleVerifyEsewa(simulateFailure: true),
                      child: const Text('Simulate Payment Failure (Release Slot)'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ] else if (_bookingStep == 'confirmed' && _selectedAppointment != null) ...[
          Card(
            color: Colors.teal.shade50,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  const Icon(Icons.check_circle, color: Colors.teal, size: 48),
                  const SizedBox(height: 8),
                  const Text('✓ Payment Verified\n✓ Appointment Confirmed',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.teal)),
                  const SizedBox(height: 12),
                  Text('Booking ID: ${_selectedAppointment!['bookingId']}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text('Token: ${_selectedAppointment!['token']}',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0D9488))),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => setState(() => _subScreen = 'appointment_detail'),
                      child: const Text('Open Appointment Details & Live Queue'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  // ===========================================================================
  // APPOINTMENT DETAILS + LIVE QUEUE + QR CHECK-IN
  // ===========================================================================
  Widget _buildAppointmentDetailScreen(String Function(String) t) {
    final misonApts = _getList('appointments').where((a) => a['patientId'] == 'pat-mison').toList();
    final apt = _selectedAppointment ?? (misonApts.isNotEmpty ? misonApts.first : null);
    if (apt == null) {
      return const Center(child: Text('No appointment selected.'));
    }
    final queues = _getList('queues');
    final currentToken = queues.isNotEmpty ? queues.first['currentToken'] : 'A-20';
    final currentNum = queues.isNotEmpty ? (queues.first['currentTokenNumber'] as int? ?? 20) : 20;
    final tokenNum = (apt['tokenNumber'] as int?) ?? 24;
    final ahead = (tokenNum - currentNum - 1).clamp(0, 99);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: Colors.teal.shade50,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${t('yourQueue')} · LIVE SOCKET.IO',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.teal)),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _QueueStat(label: 'Your Token', value: apt['token'].toString()),
                    _QueueStat(label: 'Currently', value: currentToken.toString()),
                    _QueueStat(label: 'People Ahead', value: '$ahead'),
                    _QueueStat(label: 'Est. Wait', value: '${ahead * 6} min'),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text('SECURE QR CHECK-IN PASS', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const Icon(Icons.qr_code_2, size: 120, color: Color(0xFF0F172A)),
                Text(apt['qrCheckInToken'].toString(), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(height: 10),
                if (apt['status'] == 'CONFIRMED')
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () async {
                        await _api.qrCheckIn(apt['qrCheckInToken'].toString());
                        await _syncFromBackend();
                      },
                      child: const Text('Simulate Receptionist QR Scan → Check In'),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('APPOINTMENT DETAILS', style: TextStyle(fontWeight: FontWeight.bold)),
                const Divider(),
                Text('Booking ID: ${apt['bookingId']}'),
                Text('Patient: ${apt['patientName']} (For: ${apt['forRelation']})'),
                Text('Hospital: ${apt['hospitalName']}'),
                Text('Department: ${apt['departmentName']} · ${apt['roomNumber']}'),
                Text('Doctor: ${apt['doctorName']}'),
                Text('Date & Time: ${apt['displayDate']} · ${apt['time']} (Arrive By: ${apt['arriveBy']})'),
                Text('Consultation: NPR ${apt['consultationFee']}'),
                Text('Payment: ✓ ${apt['paymentStatus']}'),
                Text('Status: ${apt['status']}', style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // TAB 3: APPOINTMENTS LIST
  // ===========================================================================
  Widget _buildAppointmentsTab(String Function(String) t, List<Map<String, dynamic>> misonAppointments) {
    if (misonAppointments.isEmpty) {
      return Center(
        child: FilledButton(
          onPressed: () => setState(() {
            _selectedDoctor = _getList('doctors').first;
            _subScreen = 'doctor_detail';
          }),
          child: const Text('Book Appointment with Dr. Suman Sharma'),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: misonAppointments.map((apt) {
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            title: Text('${apt['doctorName']} · Token ${apt['token']}',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${apt['departmentName']} · ${apt['time']} · Status: ${apt['status']}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              setState(() {
                _selectedAppointment = apt;
                _subScreen = 'appointment_detail';
              });
            },
          ),
        );
      }).toList(),
    );
  }

  // ===========================================================================
  // TAB 4: PATIENT HEALTH TIMELINE, E-PRESCRIPTIONS & LAB
  // ===========================================================================
  Widget _buildHealthTimelineTab(String Function(String) t) {
    final prescriptions = _getList('prescriptions');
    final timeline = _getList('timeline');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Patient Health Timeline', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            FilledButton.tonal(
              onPressed: () => setState(() => _subScreen = 'lab_booking'),
              child: const Text('+ Book Lab Test'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text('DIGITAL E-PRESCRIPTIONS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
        const SizedBox(height: 6),
        ...prescriptions.map((rx) {
          final meds = (rx['medicines'] as List?) ?? [];
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              title: Text('AYULINK E-PRESCRIPTION · ${rx['rxCode']}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: Text('${rx['doctorName']} · ${meds.length} Medicines · Follow-up: ${rx['followUpDate']}'),
              trailing: TextButton(
                onPressed: () => setState(() => _subScreen = 'pharmacy'),
                child: const Text('Pharmacy'),
              ),
            ),
          );
        }),
        const SizedBox(height: 12),
        const Text('CHRONOLOGICAL HEALTH TIMELINE',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
        const SizedBox(height: 8),
        ...timeline.map(
          (ev) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: const Icon(Icons.check_circle, color: Color(0xFF0D9488)),
              title: Text('${ev['dateGroup']} · ${ev['time']} — ${ev['title']}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: Text(ev['subtitle'].toString(), style: const TextStyle(fontSize: 12)),
            ),
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // LAB BOOKING & PHARMACY SUB-SCREENS
  // ===========================================================================
  Widget _buildLabBookingScreen() {
    final catalog = _getList('labCatalog');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Book Diagnostic Lab Test', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        ...catalog.map(
          (test) => Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              title: Text('${test['name']} · NPR ${test['price']}',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text('${test['category']} · ${test['preparation']}'),
              trailing: FilledButton(
                onPressed: () async {
                  await _api.bookLabTest(test['id'].toString());
                  await _syncFromBackend();
                  setState(() {
                    _subScreen = null;
                    _selectedIndex = 3;
                  });
                },
                child: const Text('Book Test'),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPharmacyScreen() {
    final orders = _getList('pharmacyOrders');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Connected Hospital Pharmacy', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        ...orders.map(
          (o) => Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              title: Text('Prescription ${o['rxCode']}', style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text('${o['pharmacyName']} · NPR ${o['totalAmount']}'),
              trailing: Chip(label: Text(o['status'].toString())),
            ),
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // EMERGENCY & HEALTH ID SUB-SCREEN
  // ===========================================================================
  Widget _buildEmergencyAndHealthIdScreen(String Function(String) t) {
    final hospitals = _getList('hospitals').where((h) => h['hasEmergency'] == true).toList();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Colors.red, width: 2),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('AYULINK EMERGENCY HEALTH ID',
                    style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12)),
                const Text('AL-NP-8F29K4', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const Text('Name: Mison Khatiwada · Blood Group: O+'),
                const Text('Known Allergies: Penicillin, Sulfonamides'),
                const Text('Critical Conditions: Mild Essential Hypertension'),
                const Text('Emergency Contact: Ramesh Khatiwada (+977-9841234567)'),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.tonal(
                    onPressed: () async {
                      await _api.scanEmergencyHealthId('AL-NP-8F29K4');
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Emergency Health ID scanned & audited on server!')),
                        );
                      }
                    },
                    child: const Text('Simulate Paramedic QR Scan (Audited)'),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text('Nearest 24/7 Emergency Hospitals', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ...hospitals.map(
          (h) => Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading: const Icon(Icons.local_hospital, color: Colors.red),
              title: Text(h['name'].toString(), style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text('${h['distanceKm']} km · 24/7 Emergency · ${h['emergencyPhone']}'),
            ),
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // AI — AYU ASSISTANT SUB-SCREEN
  // ===========================================================================
  Widget _buildAyuAssistantScreen() {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _aiMessages.length,
            itemBuilder: (_, idx) {
              final msg = _aiMessages[idx];
              final isUser = msg['role'] == 'user';
              return Align(
                alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isUser ? const Color(0xFF0D9488) : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    msg['text'] ?? '',
                    style: TextStyle(color: isUser ? Colors.white : Colors.black87, fontSize: 13),
                  ),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _aiController,
                  decoration: const InputDecoration(
                    hintText: 'Ask Ayu Assistant (e.g. Explain my CBC report)...',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                icon: const Icon(Icons.send),
                onPressed: () async {
                  final text = _aiController.text.trim();
                  if (text.isEmpty) return;
                  _aiController.clear();
                  setState(() => _aiMessages.add({'role': 'user', 'text': text}));
                  try {
                    final res = await _api.askAyuAssistant(
                      message: text,
                      locale: _locale == AyuLocale.ne ? 'ne' : _locale == AyuLocale.romanNe ? 'roman_ne' : 'en',
                    );
                    if (mounted) {
                      setState(() => _aiMessages.add({'role': 'assistant', 'text': res['reply'].toString()}));
                    }
                  } catch (_) {}
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // TAB 5: PROFILE & FAMILY MEMBERS
  // ===========================================================================
  Widget _buildProfileTab(String Function(String) t) {
    final family = _getList('familyMembers');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const ListTile(
          leading: CircleAvatar(child: Text('MK')),
          title: Text('Mison Khatiwada', style: TextStyle(fontWeight: FontWeight.bold)),
          subtitle: Text('Health ID: AL-NP-8F29K4 · Blood Group: O+'),
        ),
        const Divider(),
        const Text('FAMILY MEMBERS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey)),
        const SizedBox(height: 8),
        ...family.map(
          (f) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              title: Text('${f['relation']} — ${f['name']}', style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text('Age: ${f['age']} · Blood: ${f['bloodGroup']} · ID: ${f['healthIdCode']}'),
              trailing: TextButton(
                onPressed: () {
                  setState(() {
                    _selectedFamilyId = f['id'].toString();
                    _subScreen = 'booking';
                  });
                },
                child: const Text('Book'),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isEmergency;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
    this.isEmergency = false,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isEmergency ? Colors.red.shade200 : Colors.grey.shade300,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: isEmergency ? Colors.red : const Color(0xFF0D9488)),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QueueStat extends StatelessWidget {
  final String label;
  final String value;

  const _QueueStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
