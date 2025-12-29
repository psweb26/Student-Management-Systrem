package com.prs.studentmanagement.service;

import com.prs.studentmanagement.model.Course;
import com.prs.studentmanagement.model.Enrollment;
import com.prs.studentmanagement.model.Student;
import com.prs.studentmanagement.repository.CourseRepository;
import com.prs.studentmanagement.repository.EnrollmentRepository;
import com.prs.studentmanagement.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.util.Optional;

@Service
public class AcademicsService {

    @Autowired
    private EnrollmentRepository enrollmentRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private CourseRepository courseRepository;

    /**
     * Finds an existing enrollment record and updates the grade.
     * This supports the PUT request from the Admin Portal's Academic Grades tab.
     */
    public Enrollment updateGrade(String studentId, String courseCode, String newGrade) {
        // 1. Find the specific enrollment
        Optional<Enrollment> existingEnrollment = enrollmentRepository.findByStudent_IdAndCourse_CourseCode(studentId, courseCode);

        if (existingEnrollment.isPresent()) {
            Enrollment enrollment = existingEnrollment.get();
            enrollment.setGrade(newGrade);
            return enrollmentRepository.save(enrollment);
        } else {
            // If enrollment doesn't exist, we must create a new one (simulating enrollment)
            return createNewEnrollment(studentId, courseCode, newGrade);
        }
    }

    // Helper method to handle creation if the record wasn't found (assuming the Admin intends to add a grade for the course)
    private Enrollment createNewEnrollment(String studentId, String courseCode, String grade) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found for ID: " + studentId));

        Course course = courseRepository.findByCourseCode(courseCode)
                .orElseThrow(() -> new RuntimeException("Course not found for code: " + courseCode));

        Enrollment newEnrollment = new Enrollment();
        newEnrollment.setStudent(student);
        newEnrollment.setCourse(course);
        newEnrollment.setGrade(grade);
        newEnrollment.setEnrollmentDate(new Date(System.currentTimeMillis()));

        return enrollmentRepository.save(newEnrollment);
    }

    // FUTURE: Add methods for fetching student reports, calculating GPA, and course CRUD.
}