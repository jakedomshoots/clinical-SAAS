import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var syncEngine: SyncEngine
    
    var body: some View {
        Group {
            if authManager.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .onAppear {
            authManager.checkAuthStatus()
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject var syncEngine: SyncEngine
    
    var body: some View {
        TabView {
            ScheduleView()
                .tabItem {
                    Label("Schedule", systemImage: "calendar")
                }
            
            PatientListView()
                .tabItem {
                    Label("Patients", systemImage: "person.2")
                }
            
            TasksView()
                .tabItem {
                    Label("Tasks", systemImage: "checkmark.circle")
                }
            
            MessagesView()
                .tabItem {
                    Label("Messages", systemImage: "message")
                }
            
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
        .overlay(alignment: .topTrailing) {
            if !syncEngine.isOnline {
                OfflineBadge()
            }
        }
    }
}

struct OfflineBadge: View {
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "wifi.slash")
                .font(.caption)
            Text("Offline")
                .font(.caption.bold())
        }
        .foregroundColor(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.orange)
        .cornerRadius(16)
        .padding(.top, 8)
        .padding(.trailing, 16)
    }
}
