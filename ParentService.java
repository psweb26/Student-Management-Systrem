package com.prs.studentmanagement.service;

import com.prs.studentmanagement.dto.StudentSummary;
import com.prs.studentmanagement.model.ParentChildren;
import com.prs.studentmanagement.model.Student;
import com.prs.studentmanagement.repository.ParentChildrenRepository;
import com.prs.studentmanagement.repository.StudentRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ParentService {

    private final ParentChildrenRepository parentChildrenRepository;
    private final StudentRepository studentRepository;

    public ParentService(ParentChildrenRepository parentChildrenRepository,
                         StudentRepository studentRepository) {
        this.parentChildrenRepository = parentChildrenRepository;
        this.studentRepository = studentRepository;
    }

    /**
     * Returns a list of StudentSummary for the children mapped to the given parentId.
     * Uses the child_id values stored in parent_children and fetches minimal data
     * from the students table via StudentRepository.
     */
    public List<StudentSummary> getChildrenForParent(String parentId) {
        List<ParentChildren> mappings = parentChildrenRepository.findByParentId(parentId);

        return mappings.stream()
                .map(m -> studentRepository.findById(m.getChildId())
                        .map(s -> {
                            // Use the known child id and Student getters for name/email
                            String id = m.getChildId();
                            String first = s.getFirstName();
                            String last = s.getLastName();
                            String email = s.getEmail();
                            return new StudentSummary(id, first, last, email);
                        })
                        .orElse(null))
                .filter(s -> s != null)
                .collect(Collectors.toList());
    }
}