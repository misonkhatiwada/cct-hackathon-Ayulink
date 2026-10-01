import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as io;

/// AyuLink API & Real-Time Socket.IO Service for Flutter Patient App
/// Communicates with the unified Node.js/Express backend.
class AyuLinkApiService {
  final String baseUrl;
  late io.Socket socket;

  AyuLinkApiService({this.baseUrl = 'http://localhost:3000'});

  void connectSocket(void Function(Map<String, dynamic>) onStateSync) {
    socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .build(),
    );

    socket.on('state:sync', (data) {
      if (data is Map<String, dynamic>) {
        onStateSync(data);
      }
    });
  }

  Future<Map<String, dynamic>> fetchState() async {
    final res = await http.get(Uri.parse('$baseUrl/api/state'));
    if (res.statusCode != 200) {
      throw Exception('Failed to load AyuLink state');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> holdSlot({
    required String slotId,
    required String patientId,
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
    required String patientId,
    required String forFamilyMemberId,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/payments/esewa/initiate'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'slotId': slotId,
        'doctorId': doctorId,
        'patientId': patientId,
        'forFamilyMemberId': forFamilyMemberId,
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
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> askAyuAssistant({
    required String message,
    required String locale,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/ai/assistant'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'message': message, 'locale': locale}),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
