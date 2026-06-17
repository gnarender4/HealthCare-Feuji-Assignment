package com.narender.healthcarebackend.controller;

import com.narender.healthcarebackend.model.AuthorizationRequest;
import com.narender.healthcarebackend.service.ConnectorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/authorizations")
@CrossOrigin(origins = "*")
public class ConnectorController {

    @Autowired
    private ConnectorService service;

    @GetMapping
    public List<AuthorizationRequest> getAll() {
        return service.getAllRequests();
    }

    @PostMapping("/draft")
    public ResponseEntity<AuthorizationRequest> createDraft(@RequestBody AuthorizationRequest request) {
        return ResponseEntity.ok(service.createDraft(request));
    }

    @PutMapping("/{id}/submit")
    public ResponseEntity<AuthorizationRequest> submit(@PathVariable Long id) {
        return ResponseEntity.ok(service.transmitToPayer(id));
    }

    @PutMapping("/{id}/payer-action")
    public ResponseEntity<AuthorizationRequest> payerAction(
            @PathVariable Long id,
            @RequestParam String status,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(service.executePayerDecision(id, status, notes));
    }

    @PutMapping("/{id}/edit")
    public ResponseEntity<?> editRejectedRequest(
            @PathVariable Long id,
            @RequestBody AuthorizationRequest updatedData) {

        return service.editRejectedRequest(id, updatedData)
                .map(updatedRecord -> ResponseEntity.ok(updatedRecord))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
