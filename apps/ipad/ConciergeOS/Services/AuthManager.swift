import Foundation
import Combine

class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var cancellables = Set<AnyCancellable>()
    private let apiClient = APIClient.shared
    
    struct User: Codable {
        let id: String
        let email: String
        let fullName: String
        let role: String
        let npi: String?
    }
    
    func login(email: String, password: String) {
        isLoading = true
        errorMessage = nil
        
        apiClient.login(email: email, password: password)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                    }
                },
                receiveValue: { [weak self] user in
                    self?.currentUser = user
                    self?.isAuthenticated = true
                }
            )
            .store(in: &cancellables)
    }
    
    func logout() {
        apiClient.logout()
        currentUser = nil
        isAuthenticated = false
    }
    
    func checkAuthStatus() {
        // Check for existing token on app launch
        if apiClient.hasValidToken() {
            apiClient.fetchCurrentUser()
                .receive(on: DispatchQueue.main)
                .sink(
                    receiveCompletion: { _ in },
                    receiveValue: { [weak self] user in
                        self?.currentUser = user
                        self?.isAuthenticated = true
                    }
                )
                .store(in: &cancellables)
        }
    }
}
