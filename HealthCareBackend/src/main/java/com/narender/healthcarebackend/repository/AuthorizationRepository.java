package com.narender.healthcarebackend.repository;

import com.narender.healthcarebackend.model.AuthorizationRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuthorizationRepository extends JpaRepository<AuthorizationRequest, Long> {
}