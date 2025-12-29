package com.prs.studentmanagement.service;

import com.prs.studentmanagement.model.Student;
import com.prs.studentmanagement.repository.StudentRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * StudentService with password hashing and safe authentication.
 * Replace the existing StudentService with this file.
 */
@Service
public class StudentService {

    private final StudentRepository studentRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public StudentService(StudentRepository studentRepository, BCryptPasswordEncoder passwordEncoder) {
        this.studentRepository = studentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Authenticate by email (username) and raw password.
     * Returns Student on success, null on failure.
     */
    public Student authenticate(String username, String password) {
        Optional<Student> opt = studentRepository.findByEmail(username);
        if (opt.isPresent()) {
            Student student = opt.get();
            String hashed = student.getPassword();
            if (hashed != null && passwordEncoder.matches(password, hashed)) {
                return student;
            }
        }
        return null;
    }

    public Student getStudentById(String id) {
        return studentRepository.findById(id).orElseThrow(
                () -> new RuntimeException("Student not found with ID: " + id)
        );
    }

    public List<Student> getAllStudents() {
        return studentRepository.findAll();
    }

    /**
     * Create student — encodes password before saving (if provided).
     */
    public Student createStudent(Student student) {
        if (student.getPassword() != null && !student.getPassword().isEmpty()) {
            student.setPassword(passwordEncoder.encode(student.getPassword()));
        }
        return studentRepository.save(student);
    }

    /**
     * Update student — if a new password is provided, encode it before saving.
     */
    public Student updateStudent(String id, Student updatedStudent) {
        Student existing = studentRepository.findById(id).orElseThrow(
                () -> new RuntimeException("Student not found with ID: " + id)
        );
        existing.setFirstName(updatedStudent.getFirstName());
        existing.setLastName(updatedStudent.getLastName());
        existing.setMajor(updatedStudent.getMajor());
        existing.setGrade(updatedStudent.getGrade());
        existing.setEmail(updatedStudent.getEmail());

        // Preserve or update password (encode if updated)
        if (updatedStudent.getPassword() != null && !updatedStudent.getPassword().isEmpty()) {
            existing.setPassword(passwordEncoder.encode(updatedStudent.getPassword()));
        }

        existing.setPhoneNumber(updatedStudent.getPhoneNumber());
        existing.setDateOfBirth(updatedStudent.getDateOfBirth());
        existing.setAddress(updatedStudent.getAddress());
        existing.setProgram(updatedStudent.getProgram());
        existing.setYear(updatedStudent.getYear());
        existing.setAdvisor(updatedStudent.getAdvisor());

        return studentRepository.save(existing);
    }

    public void deleteStudent(String id) {
        studentRepository.deleteById(id);
    }
}