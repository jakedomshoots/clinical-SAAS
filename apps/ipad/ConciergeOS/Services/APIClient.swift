import Foundation
import Combine

class APIClient {
    static let shared = APIClient()
    
    private let baseURL: String
    private let session: URLSession
    private var authToken: String? {
        get { UserDefaults.standard.string(forKey: "auth_token") }
        set {
            if let token = newValue {
                UserDefaults.standard.set(token, forKey: "auth_token")
            } else {
                UserDefaults.standard.removeObject(forKey: "auth_token")
            }
        }
    }
    
    private init() {
        // Configure with your Concierge OS API endpoint
        self.baseURL = UserDefaults.standard.string(forKey: "api_base_url") ?? "https://api.concierge-os.com"
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        self.session = URLSession(configuration: config)
    }
    
    func hasValidToken() -> Bool {
        return authToken != nil
    }
    
    func setBaseURL(_ url: String) {
        UserDefaults.standard.set(url, forKey: "api_base_url")
    }
    
    // MARK: - Auth
    
    func login(email: String, password: String) -> AnyPublisher<AuthManager.User, Error> {
        let body = ["email": email, "password": password]
        return request("/api/auth/login", method: "POST", body: body)
            .handleEvents(receiveOutput: { [weak self] (response: LoginResponse) in
                self?.authToken = response.access_token
            })
            .map { $0.user }
            .eraseToAnyPublisher()
    }
    
    func logout() {
        authToken = nil
    }
    
    func fetchCurrentUser() -> AnyPublisher<AuthManager.User, Error> {
        return request("/api/auth/me", method: "GET")
    }
    
    // MARK: - Patients
    
    func fetchPatients() -> AnyPublisher<[Patient], Error> {
        return request("/api/patients", method: "GET")
    }
    
    func fetchPatient(id: String) -> AnyPublisher<Patient, Error> {
        return request("/api/patients/\(id)", method: "GET")
    }
    
    func updatePatient(_ patient: Patient) -> AnyPublisher<Patient, Error> {
        return request("/api/patients/\(patient.id)", method: "PUT", body: patient)
    }
    
    func searchPatients(query: String) -> AnyPublisher<[Patient], Error> {
        return request("/api/patients/search?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")", method: "GET")
    }
    
    // MARK: - Appointments
    
    func fetchAppointments(date: Date) -> AnyPublisher<[Appointment], Error> {
        let formatter = ISO8601DateFormatter()
        let dateStr = formatter.string(from: date)
        return request("/api/appointments?date=\(dateStr)", method: "GET")
    }
    
    func createAppointment(_ appointment: Appointment) -> AnyPublisher<Appointment, Error> {
        return request("/api/appointments", method: "POST", body: appointment)
    }
    
    // MARK: - Vitals
    
    func recordVitals(patientId: String, vitals: VitalSigns) -> AnyPublisher<VitalSigns, Error> {
        return request("/api/patients/\(patientId)/vitals", method: "POST", body: vitals)
    }
    
    // MARK: - eRx
    
    func sendPrescription(patientId: String, prescription: PrescriptionRequest) -> AnyPublisher<PrescriptionResponse, Error> {
        return request("/api/patients/\(patientId)/prescriptions", method: "POST", body: prescription)
    }
    
    // MARK: - Generic Request
    
    private func request<T: Decodable>(_ path: String, method: String, body: Encodable? = nil) -> AnyPublisher<T, Error> {
        guard let url = URL(string: baseURL + path) else {
            return Fail(error: APIError.invalidURL).eraseToAnyPublisher()
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body {
            request.httpBody = try? JSONEncoder().encode(body)
        }
        
        return session.dataTaskPublisher(for: request)
            .tryMap { data, response -> Data in
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw APIError.invalidResponse
                }
                
                if httpResponse.statusCode == 401 {
                    self.authToken = nil
                    throw APIError.unauthorized
                }
                
                guard (200...299).contains(httpResponse.statusCode) else {
                    let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
                    throw APIError.serverError(statusCode: httpResponse.statusCode, message: errorBody)
                }
                
                return data
            }
            .decode(type: T.self, decoder: JSONDecoder())
            .eraseToAnyPublisher()
    }
}

// MARK: - Supporting Types

struct LoginResponse: Decodable {
    let access_token: String
    let user: AuthManager.User
}

struct Appointment: Identifiable, Codable {
    let id: String
    var patientId: String
    var patientName: String
    var scheduledAt: Date
    var durationMinutes: Int
    var status: String
    var notes: String?
    var visitType: String
}

struct PrescriptionRequest: Codable {
    var medicationName: String
    var dosage: String
    var frequency: String
    var quantity: Int
    var refills: Int
    var pharmacyName: String
    var pharmacyPhone: String
    var notes: String?
}

struct PrescriptionResponse: Codable {
    let prescriptionId: String
    let status: String
    let message: String
}

enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case serverError(statusCode: Int, message: String)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Session expired. Please log in again."
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        }
    }
}
