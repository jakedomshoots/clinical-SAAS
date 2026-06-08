import SwiftUI

struct ScheduleView: View {
    @StateObject private var viewModel = ScheduleViewModel()
    @State private var selectedDate = Date()
    @State private var showNewAppointment = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Date picker
                DatePicker("", selection: $selectedDate, displayedComponents: .date)
                    .datePickerStyle(.graphical)
                    .padding()
                
                // Appointment list
                List(viewModel.appointments) { appointment in
                    AppointmentRow(appointment: appointment)
                }
                .listStyle(.plain)
            }
            .navigationTitle("Schedule")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { showNewAppointment = true }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNewAppointment) {
                NewAppointmentView()
            }
            .onAppear {
                viewModel.loadAppointments(for: selectedDate)
            }
            .onChange(of: selectedDate) { _, newDate in
                viewModel.loadAppointments(for: newDate)
            }
        }
    }
}

struct AppointmentRow: View {
    let appointment: Appointment
    
    var body: some View {
        HStack(spacing: 16) {
            // Time
            VStack(alignment: .trailing, spacing: 2) {
                Text(appointment.scheduledAt, style: .time)
                    .font(.system(size: 15, weight: .semibold))
                Text("\(appointment.durationMinutes)m")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(width: 60)
            
            // Status indicator
            Rectangle()
                .fill(statusColor)
                .frame(width: 4)
                .cornerRadius(2)
            
            // Details
            VStack(alignment: .leading, spacing: 4) {
                Text(appointment.patientName)
                    .font(.system(size: 16, weight: .semibold))
                
                HStack(spacing: 8) {
                    Text(appointment.visitType)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.15))
                        .foregroundColor(.blue)
                        .cornerRadius(4)
                    
                    Text(appointment.status.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                if let notes = appointment.notes {
                    Text(notes)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
        }
        .padding(.vertical, 8)
    }
    
    var statusColor: Color {
        switch appointment.status.lowercased() {
        case "confirmed": return .green
        case "checked_in": return .blue
        case "in_progress": return .orange
        case "completed": return .gray
        case "cancelled": return .red
        case "no_show": return .red
        default: return .blue
        }
    }
}

class ScheduleViewModel: ObservableObject {
    @Published var appointments: [Appointment] = []
    @Published var isLoading = false
    
    private let apiClient = APIClient.shared
    private var cancellables = Set<AnyCancellable>()
    
    func loadAppointments(for date: Date) {
        isLoading = true
        apiClient.fetchAppointments(date: date)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] _ in
                    self?.isLoading = false
                },
                receiveValue: { [weak self] appointments in
                    self?.appointments = appointments.sorted { $0.scheduledAt < $1.scheduledAt }
                }
            )
            .store(in: &cancellables)
    }
}

struct NewAppointmentView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Text("New Appointment")
                .navigationTitle("Schedule")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { dismiss() }
                    }
                }
        }
    }
}
