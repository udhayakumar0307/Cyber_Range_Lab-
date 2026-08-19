"""
Enterprise Breach - "Hidden Admin Panel" challenge.

A deliberately vulnerable internal employee-portal clone. Vulnerability:
Insecure Direct Object Reference (IDOR / broken access control) on the
/profile/<id> route - there is no session, no auth, and no check that
the requester is allowed to view that profile. The admin profile (id 1337)
is not linked anywhere in the UI, but is discoverable via an HTML comment
left in the homepage source by a "forgetful developer".
"""
from flask import Flask, render_template, abort

app = Flask(__name__)

FLAG = "flag{w3b_1d0r_h1dd3n_fl4g_9c3a}"

EMPLOYEES = {
    1: {"name": "Alex Rivera", "role": "Support Engineer", "bio": "Loves coffee and clean logs."},
    2: {"name": "Priya Nair", "role": "SOC Analyst", "bio": "Catches phishing emails before breakfast."},
    3: {"name": "Sam Okafor", "role": "DevOps", "bio": "Automates everything, including lunch orders."},
    1337: {"name": "Root Admin", "role": "System Administrator", "bio": f"Internal notes: {FLAG}"},
}


@app.route("/")
def index():
    return render_template("index.html", employees={k: v for k, v in EMPLOYEES.items() if k != 1337})


@app.route("/profile/<int:employee_id>")
def profile(employee_id):
    employee = EMPLOYEES.get(employee_id)
    if not employee:
        abort(404)
    # VULNERABLE: no check that the current visitor is allowed to view this profile.
    return render_template("profile.html", employee=employee, employee_id=employee_id)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
