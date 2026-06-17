package com.narender.healthcarebackend.controller;

import com.narender.healthcarebackend.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserRepository userRepository;

    public AuthController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");

        return userRepository.findByUsername(username)
                .map(user -> {
                    // Simple raw password check for prototype speed
                    if (user.getPassword().equals(password)) {
                        return ResponseEntity.ok(user);
                    }
                    return ResponseEntity.status(401).body("Invalid credentials");
                })
                .orElseGet(() -> ResponseEntity.status(401).body("User not found"));
    }
}