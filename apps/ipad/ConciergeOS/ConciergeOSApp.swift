import SwiftUI

@main
struct ConciergeOSApp: App {
    @StateObject private var authManager = AuthManager()
    @StateObject private var syncEngine = SyncEngine()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(syncEngine)
        }
    }
}
