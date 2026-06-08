import SwiftUI

struct PatientDetailView: View {
    @State var patient: Patient
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab = 0
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header
                PatientHeader(patient: patient)
                    .padding()
                    .background(Color(.systemBackground))
                
                // Tab picker
                Picker("Section", selection: $selectedTab) {
                    Text("Chart").tag(0)
                    Text("Vitals").tag(1)
                    Text("Meds").tag(2)
                    Text("Labs").tag(3)
                    Text("Notes").tag(4)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                
                // Content
                TabView(selection: $selectedTab) {
                    ChartView(patient: $patient)
                        .tag(0)
                    VitalsView(patient: $patient)
                        .tag(1)
                    MedicationsView(patient: $patient)
                        .tag(2)
                    LabsView(patient: $patient)
                        .tag(3)
                    NotesView(patient: $patient)
                        .tag(4)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
            .navigationTitle(patient.fullName)
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct PatientHeader: View {
    let patient: Patient
    
    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.15))
                    .frame(width: 72, height: 72)
                Text(patient.initials)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.blue)
            }
            
            VStack(alignment: .leading, spacing: 6) {
                Text(patient.fullName)
                    .font(.title2.bold())
                
                HStack(spacing: 12) {
                    Label(patient.ageDisplay, systemImage: "person.fill")
                    if let dob = patient.dateOfBirth {
                        Label(dob, systemImage: "calendar")
                    }
                }
                .font(.subheadline)
                .foregroundColor(.secondary)
                
                if let insurance = patient.insurance {
                    Text(insurance.payerName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
        }
    }
}

struct ChartView: View {
    @Binding var patient: Patient
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Allergies
                SectionCard(title: "Allergies", icon: "exclamationmark.triangle.fill", color: .orange) {
                    if patient.allergies.isEmpty {
                        Text("No known allergies")
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(patient.allergies) { allergy in
                            AllergyRow(allergy: allergy)
                        }
                    }
                }
                
                // Problems
                SectionCard(title: "Problems", icon: "stethoscope", color: .red) {
                    if patient.problems.isEmpty {
                        Text("No active problems")
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(patient.problems) { problem in
                            ProblemRow(problem: problem)
                        }
                    }
                }
                
                // Contact Info
                SectionCard(title: "Contact", icon: "phone.fill", color: .green) {
                    VStack(alignment: .leading, spacing: 8) {
                        if let phone = patient.phone {
                            Link(phone, destination: URL(string: "tel:\(phone)")!)
                        }
                        if let email = patient.email {
                            Link(email, destination: URL(string: "mailto:\(email)")!)
                        }
                        if let address = patient.address {
                            Text(address)
                        }
                    }
                }
            }
            .padding()
        }
    }
}

struct SectionCard<Content: View>: View {
    let title: String
    let icon: String
    let color: Color
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Text(title)
                    .font(.headline)
                Spacer()
            }
            
            content
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct AllergyRow: View {
    let allergy: Allergy
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(allergy.allergen)
                    .font(.subheadline.bold())
                Text(allergy.reaction)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(allergy.severity.rawValue)
                .font(.caption.bold())
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(severityColor.opacity(0.2))
                .foregroundColor(severityColor)
                .cornerRadius(8)
        }
        .padding(.vertical, 4)
    }
    
    var severityColor: Color {
        switch allergy.severity {
        case .mild: return .yellow
        case .moderate: return .orange
        case .severe: return .red
        case .lifeThreatening: return .purple
        }
    }
}

struct ProblemRow: View {
    let problem: Problem
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(problem.description)
                    .font(.subheadline)
                Text(problem.icd10Code)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(problem.status.rawValue)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct VitalsView: View {
    @Binding var patient: Patient
    @State private var showAddVitals = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let latest = patient.vitals.last {
                    LatestVitalsCard(vitals: latest)
                }
                
                // History
                SectionCard(title: "History", icon: "chart.line.uptrend.xyaxis", color: .blue) {
                    ForEach(patient.vitals.sorted(by: { $0.recordedAt > $1.recordedAt })) { vital in
                        VitalHistoryRow(vitals: vital)
                    }
                }
            }
            .padding()
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add") {
                    showAddVitals = true
                }
            }
        }
        .sheet(isPresented: $showAddVitals) {
            AddVitalsView(patientId: patient.id)
        }
    }
}

struct LatestVitalsCard: View {
    let vitals: VitalSigns
    
    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Image(systemName: "heart.fill")
                    .foregroundColor(.red)
                Text("Latest Vitals")
                    .font(.headline)
                Spacer()
                Text(vitals.recordedAt, style: .date)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                VitalBadge(label: "BP", value: vitals.bpDisplay, unit: "mmHg", color: .red)
                VitalBadge(label: "Temp", value: vitals.tempDisplay, unit: "", color: .orange)
                VitalBadge(label: "HR", value: vitals.heartRate.map(String.init) ?? "--", unit: "bpm", color: .pink)
                VitalBadge(label: "O2", value: vitals.oxygenSaturation.map { String(format: "%.0f%%", $0) } ?? "--", unit: "", color: .blue)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct VitalBadge: View {
    let label: String
    let value: String
    let unit: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.title2.bold())
                .foregroundColor(color)
            if !unit.isEmpty {
                Text(unit)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct VitalHistoryRow: View {
    let vitals: VitalSigns
    
    var body: some View {
        HStack {
            Text(vitals.recordedAt, style: .date)
                .font(.caption)
            Spacer()
            Text(vitals.bpDisplay)
                .font(.subheadline)
        }
        .padding(.vertical, 4)
    }
}

struct MedicationsView: View {
    @Binding var patient: Patient
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                let activeMeds = patient.medications.filter { $0.status == .active }
                SectionCard(title: "Active (\(activeMeds.count))", icon: "pills.fill", color: .green) {
                    ForEach(activeMeds) { med in
                        MedicationRow(medication: med)
                    }
                }
                
                let otherMeds = patient.medications.filter { $0.status != .active }
                if !otherMeds.isEmpty {
                    SectionCard(title: "Other", icon: "pills", color: .gray) {
                        ForEach(otherMeds) { med in
                            MedicationRow(medication: med)
                        }
                    }
                }
            }
            .padding()
        }
    }
}

struct MedicationRow: View {
    let medication: Medication
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(medication.name)
                    .font(.subheadline.bold())
                Spacer()
                Text(medication.status.rawValue)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Text("\(medication.dosage) • \(medication.frequency)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct LabsView: View {
    @Binding var patient: Patient
    
    var body: some View {
        VStack {
            Image(systemName: "flask.fill")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            Text("Lab Results")
                .font(.headline)
                .foregroundColor(.secondary)
            Text("Connect to LabCorp or Quest to view results")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

struct NotesView: View {
    @Binding var patient: Patient
    @State private var notes: String = ""
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                TextEditor(text: $notes)
                    .frame(minHeight: 200)
                    .padding(8)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                
                Button("Save Note") {
                    // Save note
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .padding()
        }
        .onAppear {
            notes = patient.notes ?? ""
        }
    }
}

struct NewPatientView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Text("New Patient Form")
                .navigationTitle("New Patient")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { dismiss() }
                    }
                }
        }
    }
}

struct AddVitalsView: View {
    let patientId: String
    @Environment(\.dismiss) private var dismiss
    @State private var systolic = ""
    @State private var diastolic = ""
    @State private var heartRate = ""
    @State private var temperature = ""
    @State private var oxygenSat = ""
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Blood Pressure") {
                    HStack {
                        TextField("Systolic", text: $systolic)
                            .keyboardType(.numberPad)
                        Text("/")
                        TextField("Diastolic", text: $diastolic)
                            .keyboardType(.numberPad)
                    }
                }
                
                Section("Other") {
                    TextField("Heart Rate (bpm)", text: $heartRate)
                        .keyboardType(.numberPad)
                    TextField("Temperature (°F)", text: $temperature)
                        .keyboardType(.decimalPad)
                    TextField("Oxygen Saturation (%)", text: $oxygenSat)
                        .keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Add Vitals")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        saveVitals()
                    }
                }
            }
        }
    }
    
    private func saveVitals() {
        let vitals = VitalSigns(
            recordedAt: Date(),
            bloodPressureSystolic: Int(systolic),
            bloodPressureDiastolic: Int(diastolic),
            heartRate: Int(heartRate),
            temperatureC: Double(temperature).map { ($0 - 32) * 5/9 },
            oxygenSaturation: Double(oxygenSat)
        )
        
        APIClient.shared.recordVitals(patientId: patientId, vitals: vitals)
            .sink(receiveCompletion: { _ in }, receiveValue: { _ in })
            .store(in: &Set<AnyCancellable>())
        
        dismiss()
    }
}
