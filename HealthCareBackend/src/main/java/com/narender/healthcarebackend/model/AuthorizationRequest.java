package com.narender.healthcarebackend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "authorization_requests")
@Data
public class AuthorizationRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String patientName;
    private String providerId;
    private String payerId;
    private String fhirResourceType = "Claim";

    @Column(columnDefinition = "TEXT")
    private String fhirPayload;

    private String status = "DRAFT";

    @Column(columnDefinition = "TEXT")
    private String aiCopilotReview;

    private Boolean aiPassed = false;

    @Column(columnDefinition = "TEXT")
    private String payerNotes;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
}
