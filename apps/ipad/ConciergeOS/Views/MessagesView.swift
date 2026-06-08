import SwiftUI

struct MessagesView: View {
    var body: some View {
        NavigationStack {
            List {
                MessageRow(
                    patientName: "Sarah Johnson",
                    message: "Hi Dr., can you refill my Lisinopril? I'm running low.",
                    time: "10:30 AM",
                    unread: true
                )
                MessageRow(
                    patientName: "Michael Chen",
                    message: "My lab results came back. Should I be concerned?",
                    time: "Yesterday",
                    unread: false
                )
                MessageRow(
                    patientName: "Emily Rodriguez",
                    message: "Thank you for seeing me yesterday. Feeling much better!",
                    time: "Yesterday",
                    unread: false
                )
            }
            .navigationTitle("Messages")
        }
    }
}

struct MessageRow: View {
    let patientName: String
    let message: String
    let time: String
    let unread: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.15))
                    .frame(width: 48, height: 48)
                Text(String(patientName.prefix(1)))
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.blue)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(patientName)
                        .font(.subheadline.bold())
                    Spacer()
                    Text(time)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Text(message)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            if unread {
                Circle()
                    .fill(Color.blue)
                    .frame(width: 10, height: 10)
            }
        }
        .padding(.vertical, 4)
    }
}
