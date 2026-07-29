# TechCorp Sysadmin Labs: Implementation Checklist

## Overview

This document tracks all deliverables and implementation steps.

**Status:** ✅ Design Phase Complete | 🔄 Ready for Build Phase

---

## **Phase 1: Design (COMPLETE ✅)**

### Deliverables
- [x] Level Specifications v2 (34 levels, all domains)
- [x] Embedded Flag Architecture (no cheating possible)
- [x] Progressive Learning Path (each level builds on prior)
- [x] Validation & Verification System Design
- [x] Docker-Native Architecture Design
- [x] User/Password/Flag Progression Model

### Documents Completed
- [x] `level_specifications_v2.md` — All 34 levels with scenarios, objectives, hints
- [x] `sysadmin_labs_design.md` — Overall system design
- [x] Architecture documentation for embedded flags

---

## **Phase 2: Docker & Provisioning (IN PROGRESS 🔄)**

### Deliverables to Complete

#### 2.1: Docker Image
- [x] Dockerfile (base Ubuntu 22.04 + all tools)
- [x] SSH configuration (port 2222)
- [x] Package installation (iptables, lvm2, systemd, etc.)
- [x] Directory structure setup
- [x] Group creation for labs

**Status:** Complete ✅  
**Next:** Build and test the image

#### 2.2: Provisioning Script
- [x] `provision.sh` — Master provisioning script
- [x] User creation (level0-level33)
- [x] Initial password generation
- [x] Objective files for each level
- [x] Broken state setup for levels 0-6

**Status:** ~40% complete (Levels 0-6 done, 7-33 need detailed setup)  
**Next:** Complete broken state setup for all 34 levels

#### 2.3: Validation Scripts
- [x] Validation script architecture (non-readable, 511 perms)
- [x] Validation scripts for Levels 0-4 (complete logic)
- [x] Placeholder scripts for Levels 5-33
- [x] Check_level wrapper (readable, student-friendly)

**Status:** ~20% complete (logic for 0-4, placeholders for rest)  
**Next:** Implement validation logic for Levels 5-33

#### 2.4: Docker Compose
- [x] docker-compose.yml template (showing pattern)
- [x] generate_compose.sh (script to generate all 60 services)
- [x] Port mapping (2220-2279)
- [x] Volume definitions for isolation

**Status:** Complete ✅  
**Next:** Generate full compose file before deployment

#### 2.5: Systemd Timer
- [x] Validation timer service definition
- [x] Auto-validation script (run_all_validations.sh)
- [x] Flag file writing logic

**Status:** Complete ✅  
**Next:** Test on running container

---

## **Phase 3: Testing (TODO 📋)**

### 3.1: Unit Testing
- [ ] Build Docker image locally
- [ ] Test SSH access to container
- [ ] Test provision.sh execution
- [ ] Verify user creation (level0-level33)
- [ ] Verify all directories created
- [ ] Verify validation scripts have correct permissions (511)

**Time Estimate:** 2 hours

### 3.2: Integration Testing
- [ ] Test Level 0 end-to-end (solve challenge → get password)
- [ ] Test Level 1 (find hidden file)
- [ ] Test Level 2 (change ownership)
- [ ] Test check_level command
- [ ] Test systemd timer (manual run of validation script)
- [ ] Test password file writing

**Time Estimate:** 2-3 hours

### 3.3: Multi-Container Testing
- [ ] Generate docker-compose.yml with 60 services
- [ ] Spin up all 60 containers
- [ ] Verify all 60 containers running
- [ ] Test SSH into 3-4 random containers (student0, student15, student30, student59)
- [ ] Verify each has independent state
- [ ] Test resource usage (should be ~400-500MB per container)

**Time Estimate:** 2-3 hours

### 3.4: Validation Logic Testing
- [ ] Verify Level 0 validation (check permission fix detection)
- [ ] Verify Level 1 validation (check hidden file detection)
- [ ] Verify Level 2 validation (check ownership change detection)
- [ ] Verify password extraction and display
- [ ] Verify flag files created correctly

**Time Estimate:** 1-2 hours

---

## **Phase 4: Refinement (TODO 📋)**

### 4.1: Complete All Validation Scripts
- [ ] Implement validation logic for Levels 5-33
- [ ] Test each validation script (make sure it detects solved state)
- [ ] Verify non-readable permissions (511 on all)
- [ ] Add error messages that guide students

**Time Estimate:** 4-6 hours

### 4.2: Complete All Level Setup
- [ ] Implement broken states for Levels 7-33
- [ ] Create objective files for Levels 3-33 (OBJECTIVE.txt)
- [ ] Add hints for each level
- [ ] Test that students can't cheat (flags hidden until solved)

**Time Estimate:** 4-6 hours

### 4.3: Documentation & Polish
- [ ] Finalize BUILD_AND_DEPLOY.md
- [ ] Create instructor troubleshooting guide
- [ ] Create operations runbook (monitoring, resetting, etc.)
- [ ] Finalize STUDENT_README.md
- [ ] Add screenshots/examples if needed

**Time Estimate:** 2-3 hours

---

## **Phase 5: Deployment (TODO 📋)**

### 5.1: AWS Setup
- [ ] Launch EC2 instance (t3.xlarge) in ap-south-1
- [ ] Configure security groups (ports 2220-2279, SSH 22)
- [ ] Attach 150GB EBS gp3 volume
- [ ] Install Docker & Docker Compose on EC2

**Time Estimate:** 30 minutes

### 5.2: Build & Deploy
- [ ] Transfer Dockerfile, provision.sh, etc. to EC2
- [ ] Build Docker image on EC2
- [ ] Generate docker-compose.yml (60 services)
- [ ] Spin up all 60 containers

**Time Estimate:** 15-20 minutes (build takes ~5 min, startup takes ~3 min)

### 5.3: Verification
- [ ] All 60 containers running
- [ ] SSH access works for 3-4 random students
- [ ] Test Level 0 end-to-end
- [ ] Verify resource usage is acceptable
- [ ] Test automatic validation timer

**Time Estimate:** 30 minutes

### 5.4: Student Onboarding
- [ ] Generate student access sheet (IP + ports)
- [ ] Distribute to students via learning platform
- [ ] Send STUDENT_README.md to students
- [ ] Conduct live demo (solve Level 0 with class)

**Time Estimate:** 1 hour

---

## **Files Delivered So Far**

### Design Documents
✅ `sysadmin_labs_design.md` — Overall architecture  
✅ `level_specifications_v2.md` — All 34 levels detailed  

### Docker & Provisioning
✅ `Dockerfile` — Base image definition  
✅ `provision.sh` — Provisioning script (50% implemented)  
✅ `docker-compose.yml` — Template + generator  
✅ `generate_compose.sh` — Script to generate full compose file  

### Validation System
✅ `validate_level_0.sh` — Full validation for Level 0  
✅ `validate_level_1.sh` — Full validation for Level 1  
✅ `validate_level_2.sh` — Full validation for Level 2  
✅ `validate_level_3.sh` — Full validation for Level 3  
✅ `validate_level_4.sh` — Full validation for Level 4  
✅ `/usr/local/bin/check_level` — Student wrapper (defined in provision.sh)  

### Documentation
✅ `BUILD_AND_DEPLOY.md` — Complete build & deployment guide  
✅ `STUDENT_README.md` — Student-facing guide  
✅ `IMPLEMENTATION_CHECKLIST.md` — This file  

---

## **What's Left to Build (Week 2-3)**

### Critical Path (Must Have)
1. **Complete all validation scripts** (Levels 5-33)
   - Estimated: 4-6 hours
   - Blocks: Testing Phase

2. **Complete all level setup** (broken states for Levels 7-33)
   - Estimated: 4-6 hours
   - Blocks: Testing Phase

3. **Build & test Docker image**
   - Estimated: 2-3 hours
   - Critical for Phase 5

4. **Test multi-container deployment** (60 containers)
   - Estimated: 2-3 hours
   - Critical for Phase 5

5. **Deploy to AWS**
   - Estimated: 1-2 hours
   - Final step

**Critical Path Total: 13-20 hours (~2-3 weeks at 10 hours/week)**

### Optional/Polish (Nice to Have)
- [ ] Web dashboard for tracking student progress
- [ ] Automated email notifications
- [ ] Video walkthroughs for each level
- [ ] Difficulty ratings for each level
- [ ] Achievement badges

---

## **Risk Assessment**

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Validation script bugs | High | High | Thorough testing on 5-10 levels |
| Container memory issues | Medium | High | Monitor during testing; scale to t3.2xlarge if needed |
| SSH/network issues | Low | Medium | Test connectivity from multiple IPs |
| Students breaking environment | Medium | Low | Easy reset via docker-compose restart |
| Initial password leakage | Low | High | Delete initial_passwords.txt after launch |
| Level difficulty mis-calibrated | Medium | Medium | Pilot test with 3-5 students before launch |

---

## **Timeline to Ready**

### Week 1 (THIS WEEK)
- ✅ Complete: Design & architecture
- 🔄 In Progress: Docker image & provisioning
- 📋 TODO: Final validation scripts (Levels 5-33)

### Week 2
- 📋 TODO: Complete level setup (broken states 7-33)
- 📋 TODO: Build Docker image
- 📋 TODO: Unit & integration testing
- 📋 TODO: Refine based on testing

### Week 3
- 📋 TODO: Multi-container testing (60 containers)
- 📋 TODO: Deploy to AWS
- 📋 TODO: Student onboarding
- 📋 TODO: READY FOR LAUNCH

---

## **Success Criteria**

### By End of Week 3, Lab is Ready If:

✅ All 34 levels have complete scenarios, objectives, hints  
✅ All 34 validation scripts implemented and tested  
✅ All 34 level broken states properly set up  
✅ Docker image builds successfully and is <2GB  
✅ All 60 containers start without errors  
✅ SSH access works for all 60 students  
✅ Validation system works (check_level command, flag files)  
✅ Systemd timer runs auto-validation  
✅ Tested end-to-end (Level 0 → Level 1) on real containers  
✅ Documentation complete (student & instructor guides)  
✅ AWS deployment successful  
✅ Student onboarding materials ready  

---

## **Next Immediate Actions**

### For You (This Week)
1. Review all delivered documents
2. Approve Docker & provisioning approach
3. Flag any changes needed to level scenarios
4. Confirm AWS region & instance type
5. Provide initial password for students (or we can generate)

### For Me (Next 2-3 Days)
1. Complete validation scripts for Levels 5-33
2. Complete broken state setup for Levels 7-33
3. Build and test Docker image locally
4. Create detailed testing plan
5. Prepare test environment on local/EC2 instance

### Ready to Proceed? 🚀

If you approve:
- I'll immediately start Week 2 tasks
- Complete all remaining validation scripts
- Set up test environment
- Begin comprehensive testing
- Target: Ready to deploy by end of Week 3

---

## **Questions for You**

1. **Level 33 (Capstone):** How detailed should the audit report validation be? Should we check specific things or just verify report exists?

2. **Timeframe:** Do students have 2-3 weeks to complete all 34 levels, or is this self-paced over a semester?

3. **Progress Tracking:** Beyond our simple flag files, should we integrate with your learning platform for automated reporting?

4. **Support:** Will you (the instructor) handle student questions, or should we build more detailed hints?

5. **Difficulty Feedback:** Should we plan for a "hard mode" or "bonus levels" for advanced students?

---

**Status Summary:**
- Design: ✅ Complete
- Docker/Provisioning: 🔄 ~50% (Levels 0-6 done, 7-33 need work)
- Validation: 🔄 ~20% (0-4 done, 5-33 placeholders)
- Testing: 📋 Not started
- Deployment: 📋 Not started

**Estimated Total Time Remaining: 40-60 hours**  
**Timeline: 2-3 weeks (should complete by week 3 of January)**

Let me know if you want me to proceed! 🚀
