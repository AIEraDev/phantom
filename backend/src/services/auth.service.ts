import bcrypt from "bcrypt";
import pool from "../db/connection";
import { User } from "../db/types";
import { generateToken, JWTPayload } from "../utils/jwt";

const SALT_ROUNDS = 10;

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, "password_hash">;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, username } = input;

    // Validate input
    this.validateEmail(email);
    this.validatePassword(password);
    this.validateUsername(username);

    // Check if user already exists
    const existingUser = await this.findUserByEmailOrUsername(email, username);
    if (existingUser) {
      if (existingUser.email === email) {
        throw new Error("Email already registered");
      }
      if (existingUser.username === username) {
        throw new Error("Username already taken");
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const result = await pool.query<User>(
      `INSERT INTO users (email, password_hash, username, rating, wins, losses, total_matches)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [email, passwordHash, username, 1000, 0, 0, 0]
    );

    const user = result.rows[0];

    // Generate JWT token
    const tokenPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      rating: user.rating,
    };
    const token = generateToken(tokenPayload);

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    // Find user by email
    const result = await pool.query<User>("SELECT * FROM users WHERE email = $1", [email]);

    const user = result.rows[0];
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    // Generate JWT token
    const tokenPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      rating: user.rating,
    };
    const token = generateToken(tokenPayload);

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
    };
  }

  async getUserById(userId: string): Promise<Omit<User, "password_hash"> | null> {
    const result = await pool.query<User>("SELECT * FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];
    if (!user) {
      return null;
    }
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private async findUserByEmailOrUsername(email: string, username: string): Promise<User | null> {
    const result = await pool.query<User>("SELECT * FROM users WHERE email = $1 OR username = $2", [email, username]);
    return result.rows[0] || null;
  }

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }
  }

  private validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }
  }

  private validateUsername(username: string): void {
    if (!username || username.length < 3 || username.length > 20) {
      throw new Error("Username must be between 3 and 20 characters");
    }
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      throw new Error("Username can only contain letters, numbers, hyphens, and underscores");
    }
  }
}
