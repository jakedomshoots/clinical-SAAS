import SwiftUI
import Combine

struct PatientListView: View {
    @StateObject private var viewModel = PatientListViewModel()
    @State private var searchText = ""
    @State private var selectedPatient: Patient?
    @State private var showNewPatient = false
    
    var body: some View {
        NavigationStack {
            List {
                ForEach(viewModel.filteredPatients) { patient in
                    PatientRow(patient: patient)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectedPatient = patient
                        }
                }
            }
            .listStyle(.plain)
            .searchable(text: $searchText, prompt: "Search patients")
            .onChange(of: searchText) { _, newValue in
                viewModel.search(query: newValue)
            }
            .navigationTitle("Patients")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { showNewPatient = true }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(item: $selectedPatient) { patient in
                PatientDetailView(patient: patient)
            }
            .sheet(isPresented: $showNewPatient) {
                NewPatientView()
            }
            .onAppear {
                viewModel.loadPatients()
            }
        }
    }
}

struct PatientRow: View {
    let patient: Patient
    
    var body: some View {
        HStack(spacing: 16) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.15))
                    .frame(width: 48, height: 48)
                Text(patient.initials)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.blue)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(patient.fullName)
                    .font(.system(size: 17, weight: .semibold))
                
                HStack(spacing: 8) {
                    Text(patient.ageDisplay)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    if let phone = patient.phone {
                        Text(phone)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                if let nextAppt = patient.nextAppointment {
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(.caption2)
                        Text(nextAppt, style: .date)
                            .font(.caption)
                    }
                    .foregroundColor(.blue)
                }
            }
            
            Spacer()
            
            // Status indicators
            HStack(spacing: 4) {
                if !patient.allergies.isEmpty {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.caption)
                }
                
                if !patient.medications.filter({ $0.status == .active }).isEmpty {
                    Image(systemName: "pills.fill")
                        .foregroundColor(.green)
                        .font(.caption)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

class PatientListViewModel: ObservableObject {
    @Published var patients: [Patient] = []
    @Published var filteredPatients: [Patient] = []
    @Published var isLoading = false
    
    private var cancellables = Set<AnyCancellable>()
    private let apiClient = APIClient.shared
    private let localStore = LocalStore.shared
    
    func loadPatients() {
        isLoading = true
        
        // Try local cache first
        if let cached: [Patient] = localStore.load([Patient].self, key: "patients") {
            patients = cached
            filteredPatients = cached
        }
        
        // Fetch from API
        apiClient.fetchPatients()
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] _ in
                    self?.isLoading = false
                },
                receiveValue: { [weak self] patients in
                    self?.patients = patients
                    self?.filteredPatients = patients
                    self?.localStore.save(patients, key: "patients")
                }
            )
            .store(in: &cancellables)
    }
    
    func search(query: String) {
        if query.isEmpty {
            filteredPatients = patients
        } else {
            filteredPatients = patients.filter {
                $0.fullName.localizedCaseInsensitiveContains(query) ||
                ($0.phone?.localizedCaseInsensitiveContains(query) ?? false)
            }
        }
    }
}
