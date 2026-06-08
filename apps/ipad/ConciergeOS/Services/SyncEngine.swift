import Foundation
import Combine

class SyncEngine: ObservableObject {
    @Published var isOnline = true
    @Published var pendingSyncCount = 0
    @Published var lastSyncDate: Date?
    
    private var pendingChanges: [PendingChange] = []
    private let localStore = LocalStore.shared
    private let apiClient = APIClient.shared
    private var cancellables = Set<AnyCancellable>()
    private var syncTimer: Timer?
    
    struct PendingChange: Codable {
        let id = UUID()
        let timestamp: Date
        let endpoint: String
        let method: String
        let body: Data?
        let entityType: String
        let entityId: String
    }
    
    init() {
        loadPendingChanges()
        startMonitoring()
    }
    
    func startMonitoring() {
        // Monitor network connectivity
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                let wasOffline = !(self?.isOnline ?? true)
                self?.isOnline = path.status == .satisfied
                
                if wasOffline && self?.isOnline == true {
                    self?.syncPendingChanges()
                }
            }
        }
        monitor.start(queue: DispatchQueue.global())
        
        // Periodic sync every 5 minutes
        syncTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            self?.syncPendingChanges()
        }
    }
    
    func queueChange(endpoint: String, method: String, body: Encodable?, entityType: String, entityId: String) {
        let bodyData = body.flatMap { try? JSONEncoder().encode($0) }
        let change = PendingChange(
            timestamp: Date(),
            endpoint: endpoint,
            method: method,
            body: bodyData,
            entityType: entityType,
            entityId: entityId
        )
        
        pendingChanges.append(change)
        savePendingChanges()
        
        if isOnline {
            syncPendingChanges()
        }
    }
    
    func syncPendingChanges() {
        guard isOnline, !pendingChanges.isEmpty else { return }
        
        let changes = pendingChanges
        pendingChanges.removeAll()
        savePendingChanges()
        
        for change in changes {
            // Process each pending change
            // In production, this would make the actual API call
        }
        
        lastSyncDate = Date()
    }
    
    private func loadPendingChanges() {
        if let data = UserDefaults.standard.data(forKey: "pending_changes"),
           let changes = try? JSONDecoder().decode([PendingChange].self, from: data) {
            pendingChanges = changes
            pendingSyncCount = changes.count
        }
    }
    
    private func savePendingChanges() {
        if let data = try? JSONEncoder().encode(pendingChanges) {
            UserDefaults.standard.set(data, forKey: "pending_changes")
        }
        pendingSyncCount = pendingChanges.count
    }
}

import Network

class LocalStore {
    static let shared = LocalStore()
    
    private let fileManager = FileManager.default
    private var cacheDirectory: URL {
        fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ConciergeOS")
    }
    
    private init() {
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }
    
    func save<T: Codable>(_ object: T, key: String) {
        let url = cacheDirectory.appendingPathComponent("\(key).json")
        if let data = try? JSONEncoder().encode(object) {
            try? data.write(to: url)
        }
    }
    
    func load<T: Codable>(_ type: T.Type, key: String) -> T? {
        let url = cacheDirectory.appendingPathComponent("\(key).json")
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
    
    func delete(key: String) {
        let url = cacheDirectory.appendingPathComponent("\(key).json")
        try? fileManager.removeItem(at: url)
    }
}
