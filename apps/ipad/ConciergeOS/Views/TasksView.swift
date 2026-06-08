import SwiftUI

struct TasksView: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Today") {
                    TaskRow(title: "Review lab results for Sarah Johnson", priority: .high, dueTime: "10:00 AM")
                    TaskRow(title: "Call pharmacy about prescription refill", priority: .medium, dueTime: "11:30 AM")
                    TaskRow(title: "Sign off on chart notes", priority: .low, dueTime: "2:00 PM")
                }
                
                Section("Tomorrow") {
                    TaskRow(title: "Follow up with patient — blood pressure check", priority: .medium, dueTime: "9:00 AM")
                }
            }
            .navigationTitle("Tasks")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: {}) {
                        Image(systemName: "plus")
                    }
                }
            }
        }
    }
}

struct TaskRow: View {
    let title: String
    let priority: Priority
    let dueTime: String
    @State private var isCompleted = false
    
    enum Priority {
        case high, medium, low
        
        var color: Color {
            switch self {
            case .high: return .red
            case .medium: return .orange
            case .low: return .blue
            }
        }
    }
    
    var body: some View {
        HStack(spacing: 12) {
            Button(action: { isCompleted.toggle() }) {
                Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundColor(isCompleted ? .green : .gray)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .strikethrough(isCompleted)
                    .foregroundColor(isCompleted ? .secondary : .primary)
                
                HStack(spacing: 8) {
                    Circle()
                        .fill(priority.color)
                        .frame(width: 8, height: 8)
                    Text(dueTime)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
