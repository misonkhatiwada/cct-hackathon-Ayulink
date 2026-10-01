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
  final AyuLinkApiService _api = AyuLinkApiService();
  Map<String, dynamic>? _serverState;

  @override
  void initState() {
    super.initState();
    _loadData();
    _api.connectSocket((updatedState) {
      if (mounted) {
        setState(() => _serverState = updatedState);
      }
    });
  }

  Future<void> _loadData() async {
    final data = await _api.fetchState();
    if (mounted) {
      setState(() => _serverState = data);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = (String k) => AppStrings.tr(_locale, k);

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
      home: Scaffold(
        appBar: AppBar(
          title: const Text(
            'AYULINK',
            style: TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.5),
          ),
          actions: [
            SegmentedButton<AyuLocale>(
              segments: const [
                ButtonSegment(value: AyuLocale.en, label: Text('EN')),
                ButtonSegment(value: AyuLocale.ne, label: Text('नेपाली')),
                ButtonSegment(value: AyuLocale.romanNe, label: Text('Roman')),
              ],
              selected: {_locale},
              onSelectionChanged: (val) => setState(() => _locale = val.first),
            ),
            IconButton(
              icon: Icon(_themeMode == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode),
              onPressed: () {
                setState(() {
                  _themeMode = _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
                });
              },
            ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: _loadData,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                t('greeting'),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(t('howCanWeHelp'), style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 16),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 3,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                children: [
                  _QuickActionCard(icon: Icons.person_search, label: t('findDoctor')),
                  _QuickActionCard(icon: Icons.local_hospital, label: t('findHospital')),
                  _QuickActionCard(icon: Icons.science, label: t('bookLabTest')),
                  _QuickActionCard(icon: Icons.medication, label: t('pharmacy')),
                  _QuickActionCard(icon: Icons.videocam, label: t('telemedicine')),
                  _QuickActionCard(icon: Icons.emergency, label: t('emergency'), isEmergency: true),
                ],
              ),
            ],
          ),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _selectedIndex,
          onDestinationSelected: (idx) => setState(() => _selectedIndex = idx),
          destinations: [
            NavigationDestination(icon: const Icon(Icons.home_outlined), label: t('navHome')),
            NavigationDestination(icon: const Icon(Icons.medical_services_outlined), label: t('navDoctors')),
            NavigationDestination(icon: const Icon(Icons.calendar_today_outlined), label: t('navAppointments')),
            NavigationDestination(icon: const Icon(Icons.timeline), label: t('navHealth')),
            NavigationDestination(icon: const Icon(Icons.person_outline), label: t('navProfile')),
          ],
        ),
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isEmergency;

  const _QuickActionCard({
    required this.icon,
    required this.label,
    this.isEmergency = false,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isEmergency ? Colors.red.shade200 : Colors.grey.shade200,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {},
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
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
