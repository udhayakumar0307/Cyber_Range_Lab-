# CyberRange Platform — Interactive Authentication Mockups (1.1 - 1.4)

This folder contains the complete, high-fidelity interactive static mockups built for the authentication flows of the CyberRange Platform.

These mockups utilize premium light-theme styling (off-white radial grids, glassmorphism overlays, orbiting ambient gradients, and custom SVG checkmarks/spinners) and incorporate functional JavaScript mock validations, sliding carousels, and strength checklist evaluation.

---

## 1. Page Roster

### 1.1 Login Page — [index.html](index.html)
* **Standard Credentials**: Standard forms with email format validation.
* **SSO Mode**: Organization domain redirect simulator.
* **Sliding viewport**: Swapping tabs slides the forms horizontally inside a viewport rather than using abrupt hidden toggles.
* **SVG Lock Shackle**: Brand lock icon shackle opens/unlocks when SSO redirects are selected.

### 1.2 Forgot Password Page — [forgot-password.html](forgot-password.html)
* **Onboarding**: Form field checking and recovery email dispatching simulation.
* **Success Transition**: Slides in an animated green checkmark illustration and details confirming email dispatch.

### 1.3 Reset Password Page — [reset-password.html](reset-password.html)
* **Strength Meter**: Dynamic bar indicating weak/medium/strong parameters based on complexity rules.
* **Interactive Checklist**: Checks off length, numbers, and special symbols live.
* **Matching Checker**: Prevents submit actions until the confirmation password matches.
* **Link Expiry Handler**: Appending `?token=expired` immediately prompts the link expiration error panel.

### 1.4 Register Page — [register.html](register.html)
* **Multi-Step Form**: Registration details transition into the email verification panel.
* **6-Digit Digit Grid**: Individual verification inputs that automatically forward focus as values are typed and reverse focus on backspaces.
* **Cooldown Timer**: $45\text{-second}$ resend code countdown timer.

---

## 2. Dynamic Integration Guide

These static mockups can be adapted into the root Vite+React project inside `src/pages/auth/` by separating the structure into React components and converting style properties to Tailwind CSS v4 directives:

* **Background mesh glows**: Can be mapped as reusable background components.
* **Float labels**: Integrated using custom React hooks or Tailwind peer focus classes.
* **State controllers**: Standard tab selections, sliding transitions, and loader overlays can be managed via `useState`.

---

## 3. How to Run Locally

You can spin up a simple web server from the project root directory to host and test all linked pages:

```bash
# Serve workspace files on port 8080
python3 -m http.server 8080
```

Once running, navigate your browser to:
* **Login (1.1)**: [http://localhost:8080/auth-mockups/index.html](http://localhost:8080/auth-mockups/index.html)
* **Forgot Password (1.2)**: [http://localhost:8080/auth-mockups/forgot-password.html](http://localhost:8080/auth-mockups/forgot-password.html)
* **Reset Password (1.3)**: [http://localhost:8080/auth-mockups/reset-password.html?token=demo-token](http://localhost:8080/auth-mockups/reset-password.html?token=demo-token)
* **Register (1.4)**: [http://localhost:8080/auth-mockups/register.html](http://localhost:8080/auth-mockups/register.html)
