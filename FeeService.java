package com.prs.studentmanagement.service;

import com.prs.studentmanagement.model.Fee;
import com.prs.studentmanagement.repository.FeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FeeService {

    @Autowired
    private FeeRepository feeRepository;

    /**
     * Creates a new fee record/invoice.
     * Supports the POST request from the Admin Portal's Fee Tracking tab.
     */
    public Fee createFee(Fee fee) {
        return feeRepository.save(fee);
    }

    /**
     * Fetches all fee records for a specific student ID.
     * Supports the GET request used by all portals for financial overview.
     */
    public List<Fee> getFeesByStudentId(String studentId) {
        return feeRepository.findByStudent_Id(studentId);
    }

    /**
     * Updates the status of a specific fee record to 'Paid'.
     * Supports the PUT request to record a payment.
     */
    public Fee recordPayment(Integer feeId) {
        Fee existingFee = feeRepository.findById(feeId).orElseThrow(
                () -> new RuntimeException("Fee record not found with ID: " + feeId)
        );

        // Update logic
        existingFee.setStatus("Paid");
        return feeRepository.save(existingFee);
    }

    // FUTURE: Add methods for calculating total dues, generating reports, etc.
}