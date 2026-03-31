const bcrypt = require("bcrypt");
const { Pool } = require("pg");

// 🔹 Replace YOUR_PASSWORD later
const pool = new Pool({
    connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:Vadha6859@*@localhost:5432/postgres"
});

const SALT_ROUNDS = 12;

const users = [
    {
        name: "Arjun Reddy",
        email: "arjun.reddy@securecloud.in",
        password: "Arjun@Secure#2024"
    },
    {
        name: "Priya Sharma",
        email: "priya.sharma@securecloud.in",
        password: "Priya@Cloud#2024"
    },
    {
        name: "Rahul Verma",
        email: "rahul.verma@securecloud.in",
        password: "Rahul@CSP#2024"
    },
    {
        name: "Sneha Iyer",
        email: "sneha.iyer@securecloud.in",
        password: "Sneha@Security#2024"
    },
    {
        name: "Vikram Patel",
        email: "vikram.patel@securecloud.in",
        password: "Vikram@Cloud#2024"
    }
];

async function seedUsers() {
    const client = await pool.connect();

    try {
        console.log("Starting user seeding...");

        await client.query("BEGIN");

        for (const user of users) {

            const hash = await bcrypt.hash(user.password, SALT_ROUNDS);

            const result = await client.query(
                `
        INSERT INTO users (id, email, password_hash, role, email_verified)
        VALUES (gen_random_uuid(), $1, $2, 'user', true)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
        `,
                [user.email.toLowerCase(), hash]
            );

            // If email already exists
            if (result.rows.length === 0) {
                console.log(`User already exists: ${user.email}`);
                continue;
            }

            const userId = result.rows[0].id;

            await client.query(
                `
        UPDATE users
        SET is_active = TRUE,
            email_verified = TRUE
        WHERE id = $1
        `,
                [userId]
            );

            await client.query(
                `
        INSERT INTO user_security (user_id)
        VALUES ($1)
        ON CONFLICT DO NOTHING
        `,
                [userId]
            );

            await client.query(
                `
        UPDATE user_security
        SET mfa_enabled = FALSE,
            mfa_secret = NULL,
            failed_login_attempts = 0,
            failed_otp_attempts = 0
        WHERE user_id = $1
        `,
                [userId]
            );

            console.log(`Created user: ${user.email}`);
            console.log(`Password: ${user.password}`);
            console.log("------------------------------");
        }

        await client.query("COMMIT");
        console.log("Users seeded successfully.");

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Error seeding users:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

seedUsers();
