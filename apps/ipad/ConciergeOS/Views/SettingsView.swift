import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var syncEngine: SyncEngine
    @State private var showLogoutConfirm = false
    
    var body: some View {
        NavigationStack {
            List {
                // User Profile
                Section {
                    HStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(Color.blue.opacity(0.15))
                                .frame(width: 64, height: 64)
                            Text(authManager.currentUser?.fullName.prefix(1) ?? "U")
                                .font(.system(size: 24, weight: .bold))
                                .foregroundColor(.blue)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(authManager.currentUser?.fullName ?? "User")
                                .font(.headline)
                            Text(authManager.currentUser?.email ?? "")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            if let npi = authManager.currentUser?.npi {
                                Text("NPI: \(npi)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
                
                // Sync Status
                Section("Sync") {
                    HStack {
                        Label("Status", systemImage: syncEngine.isOnline ? "wifi" : "wifi.slash")
                        Spacer()
                        Text(syncEngine.isOnline ? "Online" : "Offline")
                            .foregroundColor(syncEngine.isOnline ? .green : .orange)
                    }
                    
                    if syncEngine.pendingSyncCount > 0 {
                        HStack {
                            Label("Pending", systemImage: "arrow.clockwise")
                            Spacer()
                            Text("\(syncEngine.pendingSyncCount) changes")
                                .foregroundColor(.orange)
                        }
                    }
                    
                    if let lastSync = syncEngine.lastSyncDate {
                        HStack {
                            Label("Last Sync", systemImage: "checkmark.circle")
                            Spacer()
                            Text(lastSync, style: .relative)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                // App Info
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Build")
                        Spacer()
                        Text("2026.06.07")
                            .foregroundColor(.secondary)
                    }
                }
                
                // Logout
                Section {
                    Button(role: .destructive) {
                        showLogoutConfirm = true
                    } label: {
                        Label("Sign Out", systemImage: "arrow.right.square")
                    }
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog("Sign Out?", isPresented: $showLogoutConfirm, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) {
                    authManager.logout()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You will need to sign in again to access patient data.")
            }
        }
    }
}
