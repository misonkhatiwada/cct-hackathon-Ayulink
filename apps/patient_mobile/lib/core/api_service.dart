import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as io;

/// AyuLink API & Real-Time Socket.IO Service for Flutter Patient App
/// Automatically supports localhost:3000 (Web/iOS/Desktop) and 10.0.2.2:3000 (Android Emulator),
/// plus custom LAN IP for physical devices.
class AyuLinkApiService {
  String baseUrl;
  io.Socket? socket;

  AyuLinkApiService({this.baseUrl = 'http://localhost:3000'});

  void setBaseUrl(String newUrl, void Function(Map<String, dynamic>) onStateSync) {
    baseUrl = newUrl.trim().replaceAll(RegExp(r'/$'), '');
    connectSocket(onStateSync);
  }

  void connectSocket(void Function(Map<String, dynamic>) onStateSync) {
    try {
      socket?.disconnect();
      socket = io.io(
        baseUrl,
        io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .enableAutoConnect()
            .build(),
      );

      socket!.on('state:sync', (data) {
        if (data is Map) {
          onStateSync(Map<String, dynamic>.from(data));
        }
      });
    } catch (_) {
      // Fallback gracefully if socket fails initially
    }
  }

  Future<Map<String, dynamic>> fetchState() async {
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/api/state'))
          .timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {
      // If running on Android Emulator where localhost is 10.0.2.2, auto-switch!
      if (baseUrl.contains('localhost')) {
        try {
          final androidUrl = 'http://10.0.2.2:3000';
          final res2 = await http
              .get(Uri.parse('$androidUrl/api/state'))
              .timeout(const Duration(seconds: 3));
          if (res2.statusCode == 200) {
            baseUrl = androidUrl;
            return jsonDecode(res2.body) as Map<String, dynamic>;
          }
        } catch (_) {}
      }
    }
    return getOfflineFallbackSeed();
  }

  Future<Map<String, dynamic>> holdSlot({
    required String slotId,
    String patientId = 'pat-mison',
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/appointments/hold-slot'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'slotId': slotId, 'patientId': patientId}),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> initiateEsewaPayment({
    required String slotId,
    required String doctorId,
    String patientId = 'pat-mison',
    required String forFamilyMemberId,
    String type = 'IN_PERSON',
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/payments/esewa/initiate'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'slotId': slotId,
        'doctorId': doctorId,
        'patientId': patientId,
        'forFamilyMemberId': forFamilyMemberId,
        'type': type,
      }),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> verifyEsewaPayment(Map<String, dynamic> payload) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/payments/esewa/verify'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    if (res.statusCode >= 400) {
      final err = jsonDecode(res.body);
      throw Exception(err['error'] ?? 'Payment verification failed');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> qrCheckIn(String qrToken) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/queue/qr-checkin'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'qrToken': qrToken}),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> bookLabTest(String testId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/labs/orders'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'patientId': 'pat-mison',
        'testId': testId,
        'orderedByDoctorId': 'doc-suman',
      }),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> addFamilyMember({
    required String name,
    required String relation,
    required int age,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/patients/pat-mison/family'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'name': name,
        'relation': relation,
        'age': age,
        'gender': relation == 'Mother' ? 'Female' : 'Male',
        'bloodGroup': 'O+',
      }),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> scanEmergencyHealthId(String code) async {
    final res = await http.get(Uri.parse('$baseUrl/api/health-id/$code/emergency'));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> askAyuAssistant({
    required String message,
    required String locale,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/ai/assistant'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'message': message,
        'locale': locale,
        'patientName': 'Mison Khatiwada',
      }),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// Built-in seed data so the Flutter app renders immediately even before backend connects
  static Map<String, dynamic> getOfflineFallbackSeed() {
    return {
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
  }
}
