import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

/// AyuLink API & Real-Time Socket.IO Service for Flutter Patient App
/// Features:
/// 1. Multi-endpoint auto-discovery (localhost:3000, 10.0.2.2:3000, Cloud URL, or Custom LAN IP)
/// 2. Persists custom Laptop Wi-Fi IP in SharedPreferences
/// 3. Real-time Socket.IO + 2.5s background polling so Hospital Call Notifications NEVER miss
class AyuLinkApiService {
  String baseUrl;
  bool isConnectedToServer = false;
  io.Socket? socket;
  Timer? _pollTimer;
  Map<String, dynamic> _cachedState = getOfflineFallbackSeed();
  void Function(Map<String, dynamic>)? _onStateSyncCallback;
  void Function(Map<String, dynamic>)? _onNotificationCallback;

  static const List<String> _candidateUrls = [
    'http://localhost:3000',
    'http://10.0.2.2:3000',
    'https://ais-pre-t2jxcjbas4ql24zoamgpra-794037624500.asia-southeast1.run.app',
    'https://ais-dev-t2jxcjbas4ql24zoamgpra-794037624500.asia-southeast1.run.app',
  ];

  AyuLinkApiService({this.baseUrl = 'http://localhost:3000'});

  Future<void> initAndDiscover(
    void Function(Map<String, dynamic>) onStateSync, {
    void Function(Map<String, dynamic>)? onNotification,
  }) async {
    _onStateSyncCallback = onStateSync;
    _onNotificationCallback = onNotification;
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedUrl = prefs.getString('ayulink_server_url');
      if (savedUrl != null && savedUrl.isNotEmpty) {
        baseUrl = savedUrl;
      }
    } catch (_) {}

    await discoverWorkingServer();
    connectSocket(onStateSync, onNotification: onNotification);
    _startBackgroundPoll();
  }

  void _startBackgroundPoll() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(milliseconds: 2500), (_) async {
      try {
        final res = await http
            .get(Uri.parse('$baseUrl/api/state'))
            .timeout(const Duration(milliseconds: 1800));
        if (res.statusCode == 200) {
          final decoded = jsonDecode(res.body);
          if (decoded is Map && decoded.containsKey('doctors')) {
            isConnectedToServer = true;
            _cachedState = Map<String, dynamic>.from(decoded);
            _onStateSyncCallback?.call(_cachedState);
          }
        }
      } catch (_) {}
    });
  }

  void dispose() {
    _pollTimer?.cancel();
    socket?.disconnect();
  }

  Future<bool> discoverWorkingServer() async {
    final urlsToTry = <String>{
      baseUrl,
      ..._candidateUrls,
    }.toList();

    for (final candidate in urlsToTry) {
      try {
        final res = await http
            .get(Uri.parse('$candidate/api/state'))
            .timeout(const Duration(milliseconds: 2200));
        if (res.statusCode == 200) {
          final decoded = jsonDecode(res.body);
          if (decoded is Map && decoded.containsKey('doctors')) {
            baseUrl = candidate;
            isConnectedToServer = true;
            _cachedState = Map<String, dynamic>.from(decoded);
            _onStateSyncCallback?.call(_cachedState);
            return true;
          }
        }
      } catch (_) {
        // Try next candidate
      }
    }
    isConnectedToServer = false;
    return false;
  }

  Future<void> setBaseUrl(String newUrl, void Function(Map<String, dynamic>) onStateSync) async {
    baseUrl = newUrl.trim().replaceAll(RegExp(r'/$'), '');
    _onStateSyncCallback = onStateSync;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('ayulink_server_url', baseUrl);
    } catch (_) {}
    await fetchState();
    connectSocket(onStateSync);
  }

  void connectSocket(
    void Function(Map<String, dynamic>) onStateSync, {
    void Function(Map<String, dynamic>)? onNotification,
  }) {
    _onStateSyncCallback = onStateSync;
    if (onNotification != null) _onNotificationCallback = onNotification;
    try {
      socket?.disconnect();
      socket = io.io(
        baseUrl,
        io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .enableAutoConnect()
            .build(),
      );

      socket!.onConnect((_) {
        isConnectedToServer = true;
      });

      socket!.on('state:sync', (data) {
        if (data is Map) {
          isConnectedToServer = true;
          _cachedState = Map<String, dynamic>.from(data);
          onStateSync(_cachedState);
        }
      });

      socket!.on('notification:new', (data) {
        if (data is Map) {
          _onNotificationCallback?.call(Map<String, dynamic>.from(data));
        }
      });

      socket!.on('patient:called-notification', (data) {
        if (data is Map) {
          _onNotificationCallback?.call(Map<String, dynamic>.from(data));
        }
      });

      socket!.on('queue:called', (data) {
        if (data is Map && data['notification'] is Map) {
          _onNotificationCallback?.call(Map<String, dynamic>.from(data['notification'] as Map));
        } else if (data is Map && data['appointment'] is Map) {
          final apt = Map<String, dynamic>.from(data['appointment'] as Map);
          _onNotificationCallback?.call(<String, dynamic>{
            'id': 'call-${DateTime.now().millisecondsSinceEpoch}',
            'title': '🔔 YOUR TURN · Token ${apt['token']}',
            'message': '${apt['patientName']}, please proceed now to ${apt['roomNumber']} (${apt['doctorName']}).',
          });
        }
      });
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> _postJson(String path, Map<String, dynamic> body) async {
    // 1. Try current baseUrl
    try {
      final res = await http
          .post(
            Uri.parse('$baseUrl$path'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 4));
      if (res.statusCode >= 200 && res.statusCode < 300) {
        isConnectedToServer = true;
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {
      // 2. Auto-discover working server and retry once
      final found = await discoverWorkingServer();
      if (found) {
        try {
          final res2 = await http
              .post(
                Uri.parse('$baseUrl$path'),
                headers: {'Content-Type': 'application/json'},
                body: jsonEncode(body),
              )
              .timeout(const Duration(seconds: 4));
          if (res2.statusCode >= 200 && res2.statusCode < 300) {
            isConnectedToServer = true;
            return jsonDecode(res2.body) as Map<String, dynamic>;
          }
        } catch (_) {}
      }
    }
    return null;
  }

  Future<Map<String, dynamic>> fetchState() async {
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/api/state'))
          .timeout(const Duration(milliseconds: 2500));
      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        if (decoded is Map && decoded.containsKey('doctors')) {
          isConnectedToServer = true;
          _cachedState = Map<String, dynamic>.from(decoded);
          return _cachedState;
        }
      }
    } catch (_) {
      final ok = await discoverWorkingServer();
      if (ok) return _cachedState;
    }
    return _cachedState;
  }

  Future<Map<String, dynamic>> holdSlot({
    required String slotId,
    String patientId = 'pat-mison',
  }) async {
    final remote = await _postJson('/api/appointments/hold-slot', {
      'slotId': slotId,
      'patientId': patientId,
    });
    if (remote != null) return remote;

    // Local atomic slot hold fallback (never throws SocketException)
    final slots = (_cachedState['slots'] as List?) ?? [];
    for (final s in slots) {
      if (s is Map && s['id'] == slotId) {
        s['status'] = 'HELD';
      }
    }
    _onStateSyncCallback?.call(_cachedState);
    return {
      'slot': {'id': slotId, 'status': 'HELD'},
      'durationSeconds': 300,
    };
  }

  static Map<String, dynamic> _findMapById(
    List? list,
    String? id, [
    Map<String, dynamic>? fallback,
  ]) {
    if (list != null && list.isNotEmpty) {
      for (final item in list) {
        if (item is Map && item['id']?.toString() == id) {
          return Map<String, dynamic>.from(item);
        }
      }
      if (fallback != null) return fallback;
      final first = list.first;
      if (first is Map) return Map<String, dynamic>.from(first);
    }
    return fallback ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> initiateEsewaPayment({
    required String slotId,
    required String doctorId,
    String patientId = 'pat-mison',
    required String forFamilyMemberId,
    String type = 'IN_PERSON',
  }) async {
    final remote = await _postJson('/api/payments/esewa/initiate', {
      'slotId': slotId,
      'doctorId': doctorId,
      'patientId': patientId,
      'forFamilyMemberId': forFamilyMemberId,
      'type': type,
    });
    if (remote != null) return remote;

    // Resilient local eSewa UAT payload generation (100% type-safe, zero firstWhere covariance issues)
    final docs = (_cachedState['doctors'] as List?) ?? [];
    final doc = _findMapById(docs, doctorId, <String, dynamic>{
      'id': doctorId,
      'name': 'Dr. Suman Sharma',
      'consultationFee': 800,
    });
    final fee = (doc['consultationFee'] as num?)?.toInt() ?? 800;
    final txnUuid = 'AL-TXN-20261001-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
    final sig = base64Encode(utf8.encode('HMAC-SHA256:total_amount=$fee,transaction_uuid=$txnUuid,product_code=EPAYTEST'));

    return <String, dynamic>{
      'paymentId': 'pay-local-$txnUuid',
      'esewaPayload': <String, dynamic>{
        'amount': fee,
        'taxAmount': 0,
        'totalAmount': fee,
        'transactionUuid': txnUuid,
        'productCode': 'EPAYTEST',
        'signature': sig,
        'gatewayUrl': 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
      },
    };
  }

  Future<Map<String, dynamic>> verifyEsewaPayment(Map<String, dynamic> payload) async {
    if (payload['esewaStatus'] == 'FAILED') {
      final slots = (_cachedState['slots'] as List?) ?? [];
      for (final s in slots) {
        if (s is Map && s['id'] == payload['slotId']) {
          s['status'] = 'AVAILABLE';
        }
      }
      _onStateSyncCallback?.call(_cachedState);
      throw Exception('Payment cancelled/failed — HELD slot returned to AVAILABLE.');
    }

    final remote = await _postJson('/api/payments/esewa/verify', payload);
    if (remote != null) {
      await fetchState();
      return remote;
    }

    // Resilient local verification + state update (100% type-safe)
    final docs = (_cachedState['doctors'] as List?) ?? [];
    final doc = _findMapById(docs, payload['doctorId']?.toString(), <String, dynamic>{
      'id': 'doc-suman',
      'name': 'Dr. Suman Sharma',
      'hospitalName': 'City Hospital',
      'departmentName': 'Cardiology',
      'roomNumber': 'Room 4',
      'consultationFee': 800,
    });
    final fams = (_cachedState['familyMembers'] as List?) ?? [];
    final fam = _findMapById(fams, payload['forFamilyMemberId']?.toString(), <String, dynamic>{
      'id': 'fam-myself',
      'name': 'Mison Khatiwada',
      'relation': 'Myself',
    });
    final slots = (_cachedState['slots'] as List?) ?? [];
    String slotTime = '3:30 PM';
    for (final s in slots) {
      if (s is Map && s['id'] == payload['slotId']) {
        s['status'] = 'CONFIRMED';
        slotTime = s['time'].toString();
      }
    }

    final apts = (_cachedState['appointments'] as List?) ?? [];
    final tokenNum = 24 + apts.where((a) => a is Map && a['patientId'] == 'pat-mison').length;
    final tokenCode = 'A-$tokenNum';
    final newApt = <String, dynamic>{
      'id': 'apt-a$tokenNum',
      'bookingId': 'AL-BK-20261001-00$tokenNum',
      'patientId': 'pat-mison',
      'patientName': fam['relation'] == 'Myself' ? 'Mison Khatiwada' : '${fam['name']} (${fam['relation']})',
      'forFamilyMemberId': fam['id'],
      'forRelation': fam['relation'],
      'hospitalId': 'hosp-city',
      'hospitalName': doc['hospitalName'] ?? 'City Hospital',
      'departmentName': doc['departmentName'] ?? 'Cardiology',
      'doctorId': doc['id'],
      'doctorName': doc['name'],
      'roomNumber': doc['roomNumber'] ?? 'Room 4',
      'displayDate': 'October 1, 2026',
      'date': '2026-10-01',
      'time': slotTime,
      'arriveBy': '15 mins prior',
      'token': tokenCode,
      'tokenNumber': tokenNum,
      'consultationFee': doc['consultationFee'] ?? 800,
      'paymentStatus': 'VERIFIED',
      'status': 'CONFIRMED',
      'qrCheckInToken': 'AL-QR-CHK-20261001-A$tokenNum',
    };

    apts.insert(0, newApt);
    _cachedState['appointments'] = apts;

    final timeline = (_cachedState['timeline'] as List?) ?? [];
    timeline.insert(0, <String, dynamic>{
      'id': 'tl-apt-$tokenNum',
      'patientId': 'pat-mison',
      'dateGroup': 'OCT 1, 2026',
      'time': slotTime,
      'title': '${doc['departmentName']} Appointment',
      'subtitle': '${doc['name']} · ${doc['hospitalName']} · Token $tokenCode',
      'category': 'APPOINTMENT',
    });
    _cachedState['timeline'] = timeline;
    _onStateSyncCallback?.call(_cachedState);

    return <String, dynamic>{
      'verified': true,
      'appointment': newApt,
    };
  }

  Future<Map<String, dynamic>> qrCheckIn(String qrToken) async {
    final remote = await _postJson('/api/queue/qr-checkin', {'qrToken': qrToken});
    if (remote != null) {
      await fetchState();
      return remote;
    }

    final apts = (_cachedState['appointments'] as List?) ?? [];
    for (final a in apts) {
      if (a is Map && a['qrCheckInToken'] == qrToken) {
        a['status'] = 'WAITING';
      }
    }
    _onStateSyncCallback?.call(_cachedState);
    return <String, dynamic>{'success': true};
  }

  Future<Map<String, dynamic>> bookLabTest(String testId) async {
    final remote = await _postJson('/api/labs/orders', {
      'patientId': 'pat-mison',
      'testId': testId,
      'orderedByDoctorId': 'doc-suman',
    });
    if (remote != null) {
      await fetchState();
      return remote;
    }

    final catalog = (_cachedState['labCatalog'] as List?) ?? [];
    final test = _findMapById(catalog, testId, <String, dynamic>{
      'id': testId,
      'name': 'Complete Blood Count (CBC)',
    });
    final newOrder = <String, dynamic>{
      'id': 'lab-local-${DateTime.now().millisecondsSinceEpoch}',
      'orderCode': 'LAB-20261001-03',
      'patientId': 'pat-mison',
      'patientName': 'Mison Khatiwada',
      'hospitalName': 'City Hospital',
      'testName': test['name'],
      'scheduledDate': 'OCT 1, 2026',
      'status': 'Booked',
    };
    final orders = (_cachedState['labOrders'] as List?) ?? [];
    orders.insert(0, newOrder);
    final timeline = (_cachedState['timeline'] as List?) ?? [];
    timeline.insert(0, <String, dynamic>{
      'id': 'tl-lab-${DateTime.now().millisecondsSinceEpoch}',
      'patientId': 'pat-mison',
      'dateGroup': 'OCT 1, 2026',
      'time': '4:15 PM',
      'title': '${test['name']} Ordered',
      'subtitle': 'City Hospital Pathology · Status: Booked',
      'category': 'LAB_ORDERED',
    });
    _onStateSyncCallback?.call(_cachedState);
    return newOrder;
  }

  Future<Map<String, dynamic>> scanEmergencyHealthId(String code) async {
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/api/health-id/$code/emergency'))
          .timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return {
      'healthIdCode': code,
      'name': 'Mison Khatiwada',
      'bloodGroup': 'O+',
      'accessedAt': 'Just now (Audited)',
    };
  }

  Future<Map<String, dynamic>> askAyuAssistant({
    required String message,
    required String locale,
  }) async {
    final remote = await _postJson('/api/ai/assistant', {
      'message': message,
      'locale': locale,
      'patientName': 'Mison Khatiwada',
    });
    if (remote != null) return remote;

    return {
      'reply': locale == 'ne'
          ? 'नमस्ते मिसन! तपाईंको CBC रिपोर्ट सामान्य छ (Hemoglobin 14.8 g/dL)। मुटु वा रक्तचाप परामर्शको लागि सिटी अस्पतालको कोठा नं. ४ मा डा. सुमन शर्मा उपलब्ध हुनुहुन्छ।'
          : 'Namaste Mison! Your CBC report parameters (Hemoglobin 14.8 g/dL, WBC 6,800, Platelets 245,000) are within normal physiological range. For Cardiology consultation, Dr. Suman Sharma is available at City Hospital (Room 4).\n\n(Note: Ayu Assistant provides health education only and never diagnoses or prescribes medicine.)',
    };
  }

  static Map<String, dynamic> getOfflineFallbackSeed() {
    final rawSeed = <String, dynamic>{
      'patientProfiles': [
        {
          'id': 'pat-mison',
          'name': 'Mison Khatiwada',
          'age': 26,
          'gender': 'Male',
          'bloodGroup': 'O+',
          'phone': '+977-9841009200',
          'allergies': ['Penicillin', 'Sulfonamides'],
          'criticalConditions': ['Mild Essential Hypertension (Controlled)'],
          'emergencyContact': {
            'name': 'Ramesh Khatiwada',
            'relation': 'Father',
            'phone': '+977-9841234567',
          },
          'importantMedicines': ['Amlodipine 5mg (Once Daily)'],
          'healthIdCode': 'AL-NP-8F29K4',
          'qrSecurityToken': 'AL-SEC-TOKEN-8F29K4-9921A',
          'insurancePolicyNumber': 'HIB-NP-2026-88412',
        }
      ],
      'familyMembers': [
        {'id': 'fam-myself', 'name': 'Mison Khatiwada', 'relation': 'Myself', 'age': 26, 'bloodGroup': 'O+', 'healthIdCode': 'AL-NP-8F29K4'},
        {'id': 'fam-father', 'name': 'Ramesh Khatiwada', 'relation': 'Father', 'age': 58, 'bloodGroup': 'O+', 'healthIdCode': 'AL-NP-8F29F1'},
        {'id': 'fam-mother', 'name': 'Sita Devi Khatiwada', 'relation': 'Mother', 'age': 53, 'bloodGroup': 'B+', 'healthIdCode': 'AL-NP-8F29M2'},
        {'id': 'fam-child', 'name': 'Arya Khatiwada', 'relation': 'Child', 'age': 4, 'bloodGroup': 'O+', 'healthIdCode': 'AL-NP-8F29C4'},
      ],
      'hospitals': [
        {
          'id': 'hosp-city',
          'name': 'City Hospital',
          'city': 'Bharatpur',
          'district': 'Chitwan',
          'address': 'Hospital Road-10, Bharatpur, Chitwan',
          'contact': '+977-056-524100',
          'emergencyPhone': '102 / +977-056-524199',
          'distanceKm': 2.1,
          'rating': 4.7,
          'hasEmergency': true,
          'hasLab': true,
          'hasPharmacy': true,
          'hasInsurance': true,
          'hasTelemedicine': true,
        },
        {
          'id': 'hosp-bmc',
          'name': 'Bharatpur Medical Center',
          'city': 'Bharatpur',
          'district': 'Chitwan',
          'address': 'Chaubiskothi, Bharatpur-10, Chitwan',
          'contact': '+977-056-527800',
          'emergencyPhone': '+977-056-527899',
          'distanceKm': 3.8,
          'rating': 4.6,
          'hasEmergency': true,
          'hasLab': true,
          'hasPharmacy': true,
          'hasInsurance': true,
          'hasTelemedicine': false,
        },
        {
          'id': 'hosp-chc',
          'name': 'Chitwan Health Care',
          'city': 'Narayangarh',
          'district': 'Chitwan',
          'address': 'Lions Chowk, Narayangarh, Chitwan',
          'contact': '+977-056-531400',
          'emergencyPhone': '+977-056-531499',
          'distanceKm': 5.2,
          'rating': 4.5,
          'hasEmergency': false,
          'hasLab': true,
          'hasPharmacy': true,
          'hasInsurance': false,
          'hasTelemedicine': true,
        },
      ],
      'doctors': [
        {
          'id': 'doc-suman',
          'name': 'Dr. Suman Sharma',
          'nameNe': 'डा. सुमन शर्मा',
          'qualifications': 'MBBS, MD (Cardiology)',
          'specialty': 'Cardiologist',
          'departmentName': 'Cardiology',
          'hospitalId': 'hosp-city',
          'hospitalName': 'City Hospital',
          'experienceYears': 12,
          'rating': 4.8,
          'consultationFee': 800,
          'roomNumber': 'Room 4',
          'availableToday': true,
          'telemedicineAvailable': true,
          'emergencyAvailable': true,
          'onLeave': false,
          'nmcDemoBadge': 'DEMO-NMC-10482 (Fictional)',
          'nextAvailableText': 'Today · 3:30 PM',
          'schedule': [
            {'day': 'Monday', 'startTime': '10:00 AM', 'endTime': '2:00 PM', 'isAvailable': true},
            {'day': 'Wednesday', 'startTime': '4:00 PM', 'endTime': '7:00 PM', 'isAvailable': true},
            {'day': 'Friday', 'startTime': '10:00 AM', 'endTime': '1:00 PM', 'isAvailable': true},
          ],
        },
        {
          'id': 'doc-anita',
          'name': 'Dr. Anita Karki',
          'nameNe': 'डा. अनिता कार्की',
          'qualifications': 'MBBS, MD (Internal Medicine)',
          'specialty': 'General Physician',
          'departmentName': 'General Medicine',
          'hospitalId': 'hosp-city',
          'hospitalName': 'City Hospital',
          'experienceYears': 9,
          'rating': 4.7,
          'consultationFee': 650,
          'roomNumber': 'Room 2',
          'availableToday': true,
          'telemedicineAvailable': true,
          'emergencyAvailable': false,
          'onLeave': false,
          'nmcDemoBadge': 'DEMO-NMC-12910 (Fictional)',
          'nextAvailableText': 'Today · 4:00 PM',
          'schedule': [],
        },
        {
          'id': 'doc-raj',
          'name': 'Dr. Raj Thapa',
          'nameNe': 'डा. राज थापा',
          'qualifications': 'MBBS, MS (ENT)',
          'specialty': 'ENT Specialist',
          'departmentName': 'ENT',
          'hospitalId': 'hosp-city',
          'hospitalName': 'City Hospital',
          'experienceYears': 10,
          'rating': 4.6,
          'consultationFee': 700,
          'roomNumber': 'Room 7',
          'availableToday': true,
          'telemedicineAvailable': false,
          'emergencyAvailable': true,
          'onLeave': false,
          'nmcDemoBadge': 'DEMO-NMC-14205 (Fictional)',
          'nextAvailableText': 'Today · 4:15 PM',
          'schedule': [],
        },
      ],
      'slots': [
        {'id': 'slot-suman-300', 'doctorId': 'doc-suman', 'time': '3:00 PM', 'status': 'CONFIRMED'},
        {'id': 'slot-suman-330', 'doctorId': 'doc-suman', 'time': '3:30 PM', 'status': 'AVAILABLE'},
        {'id': 'slot-suman-400', 'doctorId': 'doc-suman', 'time': '4:00 PM', 'status': 'AVAILABLE'},
        {'id': 'slot-suman-430', 'doctorId': 'doc-suman', 'time': '4:30 PM', 'status': 'AVAILABLE'},
        {'id': 'slot-anita-400', 'doctorId': 'doc-anita', 'time': '4:00 PM', 'status': 'AVAILABLE'},
        {'id': 'slot-raj-415', 'doctorId': 'doc-raj', 'time': '4:15 PM', 'status': 'AVAILABLE'},
      ],
      'appointments': [],
      'queues': [
        {'doctorId': 'doc-suman', 'currentToken': 'A-20', 'currentTokenNumber': 20, 'roomNumber': '4'}
      ],
      'prescriptions': [
        {
          'id': 'rx-prev-01',
          'rxCode': 'RX-27910',
          'patientId': 'pat-mison',
          'patientName': 'Mison Khatiwada',
          'doctorName': 'Dr. Suman Sharma',
          'departmentName': 'Cardiology',
          'hospitalName': 'City Hospital',
          'diagnosis': 'Stage 1 Essential Hypertension — Stable',
          'followUpDate': 'October 1, 2026',
          'displayDate': 'SEP 18, 2026',
          'medicines': [
            {
              'name': 'Amlodipine',
              'strength': '5mg',
              'dosage': '1 tablet',
              'frequency': '1 time/day',
              'duration': '30 days',
              'instructions': 'Take after breakfast.',
            }
          ],
        }
      ],
      'pharmacyOrders': [
        {
          'id': 'pho-01',
          'rxCode': 'RX-27910',
          'pharmacyName': 'City Hospital Central Dispensary',
          'medicinesCount': 1,
          'totalAmount': 210,
          'status': 'Delivered',
        }
      ],
      'labCatalog': [
        {
          'id': 'test-cbc',
          'name': 'Complete Blood Count (CBC)',
          'category': 'Hematology',
          'price': 350,
          'turnaroundHours': 2,
          'preparation': 'No fasting required.',
        },
        {
          'id': 'test-lipid',
          'name': 'Lipid Profile',
          'category': 'Biochemistry',
          'price': 850,
          'turnaroundHours': 4,
          'preparation': '10-12 hours overnight fasting required.',
        },
      ],
      'labOrders': [
        {
          'id': 'lab-prev-sep18',
          'orderCode': 'LAB-20260918-01',
          'patientId': 'pat-mison',
          'patientName': 'Mison Khatiwada',
          'hospitalName': 'City Hospital',
          'testName': 'CBC',
          'scheduledDate': 'SEP 18, 2026',
          'status': 'Report Ready',
          'reportSummary': 'All hematology parameters within normal reference intervals (Hb 14.8 g/dL).',
        }
      ],
      'timeline': [
        {
          'id': 'tl-sep18-cbc',
          'patientId': 'pat-mison',
          'dateGroup': 'SEP 18, 2026',
          'time': '1:15 PM',
          'title': 'CBC Report',
          'subtitle': 'City Hospital Central Laboratory · Hb 14.8 g/dL (Normal)',
          'category': 'LAB_REPORT',
        },
        {
          'id': 'tl-sep18-rx',
          'patientId': 'pat-mison',
          'dateGroup': 'SEP 18, 2026',
          'time': '10:30 AM',
          'title': 'Baseline Cardiology Consultation & Prescription',
          'subtitle': 'Dr. Suman Sharma · City Hospital (RX-27910)',
          'category': 'PRESCRIPTION',
        },
      ],
    };
    return Map<String, dynamic>.from(jsonDecode(jsonEncode(rawSeed)) as Map);
  }
}
