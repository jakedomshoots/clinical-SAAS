import Foundation

struct Patient: Identifiable, Codable, Hashable {
    let id: String
    var firstName: String
    var lastName: String
    var dateOfBirth: Date?
    var phone: String?
    var email: String?
    var address: String?
    var insurance: InsuranceInfo?
    var emergencyContact: EmergencyContact?
    var allergies: [Allergy]
    var medications: [Medication]
    var problems: [Problem]
    var vitals: [VitalSigns]
    var notes: String?
    var lastVisit: Date?
    var nextAppointment: Date?
    
    var fullName: String { "\(firstName) \(lastName)" }
    var initials: String {
        let f = firstName.prefix(1)
        let l = lastName.prefix(1)
        return "\(f)\(l)"
    }
    var age: Int? {
        guard let dob = dateOfBirth else { return nil }
        return Calendar.current.dateComponents([.year], from: dob, to: Date()).year
    }
    var ageDisplay: String {
        guard let age = age else { return "Unknown" }
        return "\(age)y"
    }
}

struct InsuranceInfo: Codable, Hashable {
    var payerName: String
    var policyNumber: String
    var groupNumber: String?
    var subscriberName: String?
    var copay: Double?
}

struct EmergencyContact: Codable, Hashable {
    var name: String
    var relationship: String
    var phone: String
}

struct Allergy: Identifiable, Codable, Hashable {
    let id = UUID()
    var allergen: String
    var reaction: String
    var severity: AllergySeverity
    var onsetDate: Date?
}

enum AllergySeverity: String, Codable, CaseIterable {
    case mild = "Mild"
    case moderate = "Moderate"
    case severe = "Severe"
    case lifeThreatening = "Life-threatening"
}

struct Medication: Identifiable, Codable, Hashable {
    let id = UUID()
    var name: String
    var dosage: String
    var frequency: String
    var prescribedDate: Date?
    var prescribedBy: String?
    var status: MedicationStatus
}

enum MedicationStatus: String, Codable, CaseIterable {
    case active = "Active"
    case discontinued = "Discontinued"
    case onHold = "On Hold"
}

struct Problem: Identifiable, Codable, Hashable {
    let id = UUID()
    var icd10Code: String
    var description: String
    var onsetDate: Date?
    var status: ProblemStatus
}

enum ProblemStatus: String, Codable, CaseIterable {
    case active = "Active"
    case resolved = "Resolved"
    case chronic = "Chronic"
}

struct VitalSigns: Identifiable, Codable, Hashable {
    let id = UUID()
    var recordedAt: Date
    var heightCm: Double?
    var weightKg: Double?
    var bmi: Double?
    var temperatureC: Double?
    var heartRate: Int?
    var bloodPressureSystolic: Int?
    var bloodPressureDiastolic: Int?
    var respiratoryRate: Int?
    var oxygenSaturation: Double?
    var painScore: Int?
    
    var bpDisplay: String {
        guard let sys = bloodPressureSystolic, let dia = bloodPressureDiastolic else { return "--/--" }
        return "\(sys)/\(dia)"
    }
    
    var tempDisplay: String {
        guard let temp = temperatureC else { return "--" }
        return String(format: "%.1f°F", temp * 9/5 + 32)
    }
}
