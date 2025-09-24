"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testEmailConnection = exports.sendPasswordResetEmail = exports.sendSchoolAdminWelcomeEmail = exports.sendPrincipalWelcomeEmail = exports.sendTeacherWelcomeEmail = exports.sendParentWelcomeEmail = exports.generatePassword = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const setup_1 = require("./setup");
// Create transporter
const createTransporter = () => {
    const config = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
        },
    };
    return nodemailer_1.default.createTransport(config);
};
// Generate random password
const generatePassword = (length = 12) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    // Ensure at least one uppercase, one lowercase, one number, and one special character
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
    }
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
};
exports.generatePassword = generatePassword;
// Send welcome email to new parent
const sendParentWelcomeEmail = async (email, name, surname, studentName, studentSurname, schoolName, generatedPassword) => {
    try {
        const transporter = createTransporter();
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'EduTrack'}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Welcome to EduTrack - Parent Account Created`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0;">Welcome to EduTrack!</h2>
          </div>

          <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
            <p style="font-size: 16px; color: #333; margin-bottom: 15px;">
              Dear ${name} ${surname},
            </p>

            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 15px;">
              Your parent account has been successfully created for <strong>${schoolName}</strong>.
              A student record for <strong>${studentName} ${studentSurname}</strong> has been created and is now associated with your account.
            </p>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #007bff;">
              <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Your Login Credentials</h3>
              <p style="margin: 5px 0; font-size: 14px; color: #333;">
                <strong>Email:</strong> ${email}
              </p>
              <p style="margin: 5px 0; font-size: 14px; color: #333;">
                <strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${generatedPassword}</code>
              </p>
            </div>

            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
              </p>
            </div>

            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 15px;">
              You can now log in to the EduTrack platform to:
            </p>

            <ul style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;">
              <li>View your child's academic progress</li>
              <li>Access attendance records</li>
              <li>Review assignments and results</li>
              <li>Receive important notifications</li>
              <li>Communicate with teachers</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://edutrack.com/login'}"
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Login to EduTrack
              </a>
            </div>

            <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
              If you have any questions, please contact your school's administration.<br>
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </div>
      `,
            text: `
        Welcome to EduTrack!

        Dear ${name} ${surname},

        Your parent account has been successfully created for ${schoolName}.
        A student record for ${studentName} ${studentSurname} has been created and is now associated with your account.

        Your Login Credentials:
        Email: ${email}
        Temporary Password: ${generatedPassword}

        IMPORTANT: Please change your password after your first login for security purposes.

        You can now log in to the EduTrack platform to view your child's academic progress, attendance records, assignments, results, and receive important notifications.

        Login at: ${process.env.FRONTEND_URL || 'https://edutrack.com/login'}

        If you have any questions, please contact your school's administration.
        This is an automated message, please do not reply to this email.
      `,
        };
        const info = await transporter.sendMail(mailOptions);
        setup_1.logger.info('Parent welcome email sent successfully', {
            email,
            messageId: info.messageId,
            parentName: `${name} ${surname}`,
            studentName: `${studentName} ${studentSurname}`
        });
        return true;
    }
    catch (error) {
        setup_1.logger.error('Failed to send parent welcome email', {
            email,
            error: error instanceof Error ? error.message : 'Unknown error',
            parentName: `${name} ${surname}`,
            studentName: `${studentName} ${studentSurname}`
        });
        return false;
    }
};
exports.sendParentWelcomeEmail = sendParentWelcomeEmail;
// Send welcome email to new teacher
const sendTeacherWelcomeEmail = async (email, name, surname, schoolName, generatedPassword) => {
    try {
        const transporter = createTransporter();
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'EduTrack'}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Welcome to EduTrack - Teacher Account Created`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0;">Welcome to EduTrack!</h2>
          </div>

          <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
            <p style="font-size: 16px; color: #333; margin-bottom: 15px;">
              Dear ${name} ${surname},
            </p>

            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 15px;">
              Your teacher account has been successfully created for <strong>${schoolName}</strong>.
              You now have access to manage your classes and support student learning on the EduTrack platform.
            </p>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Your Login Credentials</h3>
              <p style="margin: 5px 0; font-size: 14px; color: #333;">
                <strong>Email:</strong> ${email}
              </p>
              <p style="margin: 5px 0; font-size: 14px; color: #333;">
                <strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${generatedPassword}</code>
              </p>
            </div>

            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
              </p>
            </div>

            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 15px;">
              As a teacher, you can now:
            </p>

            <ul style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;">
              <li>Access your class schedules and student lists</li>
              <li>Create and manage assignments and assessments</li>
              <li>Record attendance and track student progress</li>
              <li>Communicate with parents and school administration</li>
              <li>Access curriculum materials and resources</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://edutrack.com/login'}"
                 style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Login to EduTrack
              </a>
            </div>

            <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
              If you have any questions, please contact your school administration.<br>
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </div>
      `,
            text: `
        Welcome to EduTrack!

        Dear ${name} ${surname},

        Your teacher account has been successfully created for ${schoolName}.
        You now have access to manage your classes and support student learning on the EduTrack platform.

        Your Login Credentials:
        Email: ${email}
        Temporary Password: ${generatedPassword}

        IMPORTANT: Please change your password after your first login for security purposes.

        As a teacher, you can now access your class schedules, create assignments, record attendance, communicate with parents, and access curriculum resources.

        Login at: ${process.env.FRONTEND_URL || 'https://edutrack.com/login'}

        If you have any questions, please contact your school administration.
        This is an automated message, please do not reply to this email.
      `,
        };
        const info = await transporter.sendMail(mailOptions);
        setup_1.logger.info('Teacher welcome email sent successfully', {
            email,
            messageId: info.messageId,
            teacherName: `${name} ${surname}`,
            schoolName
        });
        return true;
    }
    catch (error) {
        setup_1.logger.error('Failed to send teacher welcome email', {
            email,
            error: error instanceof Error ? error.message : 'Unknown error',
            teacherName: `${name} ${surname}`,
            schoolName
        });
        return false;
    }
};
exports.sendTeacherWelcomeEmail = sendTeacherWelcomeEmail;
// Send welcome email to new principal
const sendPrincipalWelcomeEmail = async (email, name, surname, schoolName, generatedPassword) => {
    try {
        const transporter = createTransporter();
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'EduTrack'}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Welcome to EduTrack - Principal Account Created`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0;">Welcome to EduTrack!</h2>
          </div>

          <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
            <p style="font-size: 16px; color: #333; margin-bottom: 15px;">
              Dear ${name} ${surname},
            </p>

            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 15px;">
              Your principal account has been successfully created for <strong>${schoolName}</strong>.
              You now have leadership access to oversee and manage your school's EduTrack platform.
            </p>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Your Login Credentials</h3>
              <p style="margin: 5px 0; font-size: 14px; color: #333;">
                <strong>Email:</strong> ${email}
              </p>
              <p style="margin: 5px 0; font-size: 14px; color: #333;">
                <strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${generatedPassword}</code>
              </p>
            </div>

            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
              </p>
            </div>

            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 15px;">
              As a school principal, you can now:
            </p>

            <ul style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;">
              <li>Oversee all school operations and staff management</li>
              <li>Access comprehensive school analytics and reports</li>
              <li>Approve academic records and manage curriculum</li>
              <li>Create school-wide events and announcements</li>
              <li>Manage school policies and configurations</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://edutrack.com/login'}"
                 style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Login to EduTrack
              </a>
            </div>

            <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
              If you have any questions, please contact support.<br>
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </div>
      `,
            text: `
        Welcome to EduTrack!

        Dear ${name} ${surname},

        Your principal account has been successfully created for ${schoolName}.
        You now have leadership access to oversee and manage your school's EduTrack platform.

        Your Login Credentials:
        Email: ${email}
        Temporary Password: ${generatedPassword}

        IMPORTANT: Please change your password after your first login for security purposes.

        As a school principal, you can now oversee school operations, access analytics, approve records, create events, and manage school policies.

        Login at: ${process.env.FRONTEND_URL || 'https://edutrack.com/login'}

        If you have any questions, please contact support.
        This is an automated message, please do not reply to this email.
      `,
        };
        const info = await transporter.sendMail(mailOptions);
        setup_1.logger.info('Principal welcome email sent successfully', {
            email,
            messageId: info.messageId,
            principalName: `${name} ${surname}`,
            schoolName
        });
        return true;
    }
    catch (error) {
        setup_1.logger.error('Failed to send principal welcome email', {
            email,
            error: error instanceof Error ? error.message : 'Unknown error',
            principalName: `${name} ${surname}`,
            schoolName
        });
        return false;
    }
};
exports.sendPrincipalWelcomeEmail = sendPrincipalWelcomeEmail;
// Send welcome email to new school admin
const sendSchoolAdminWelcomeEmail = async (email, name, surname, schoolName, generatedPassword) => {
    try {
        const transporter = createTransporter();
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'EduTrack'}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Welcome to EduTrack - School Admin Account Created`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0;">Welcome to EduTrack!</h2>
          </div>

          <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
            <p style="font-size: 16px; color: #333; margin-bottom: 15px;">
              Dear ${name} ${surname},
            </p>

            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 15px;">
              Your school admin account has been successfully created for <strong>${schoolName}</strong>.
              You now have administrative access to manage your school's EduTrack platform.
            </p>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #007bff;">
              <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Your Login Credentials</h3>
              <p style="margin: 5px 0; font-size: 14px; color: #333;">
                <strong>Email:</strong> ${email}
              </p>
              <p style="margin: 5px 0; font-size: 14px; color: #333;">
                <strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${generatedPassword}</code>
              </p>
            </div>

            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
              </p>
            </div>

            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 15px;">
              As a school administrator, you can now:
            </p>

            <ul style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;">
              <li>Manage teachers, students, and classes</li>
              <li>Access school analytics and reports</li>
              <li>Configure school settings and preferences</li>
              <li>Communicate with parents and staff</li>
              <li>Oversee academic progress and attendance</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://edutrack.com/login'}"
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Login to EduTrack
              </a>
            </div>

            <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
              If you have any questions, please contact support.<br>
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </div>
      `,
            text: `
        Welcome to EduTrack!

        Dear ${name} ${surname},

        Your school admin account has been successfully created for ${schoolName}.
        You now have administrative access to manage your school's EduTrack platform.

        Your Login Credentials:
        Email: ${email}
        Temporary Password: ${generatedPassword}

        IMPORTANT: Please change your password after your first login for security purposes.

        As a school administrator, you can now manage teachers, students, classes, access analytics, configure settings, and communicate with parents and staff.

        Login at: ${process.env.FRONTEND_URL || 'https://edutrack.com/login'}

        If you have any questions, please contact support.
        This is an automated message, please do not reply to this email.
      `,
        };
        const info = await transporter.sendMail(mailOptions);
        setup_1.logger.info('School admin welcome email sent successfully', {
            email,
            messageId: info.messageId,
            adminName: `${name} ${surname}`,
            schoolName
        });
        return true;
    }
    catch (error) {
        setup_1.logger.error('Failed to send school admin welcome email', {
            email,
            error: error instanceof Error ? error.message : 'Unknown error',
            adminName: `${name} ${surname}`,
            schoolName
        });
        return false;
    }
};
exports.sendSchoolAdminWelcomeEmail = sendSchoolAdminWelcomeEmail;
// Send password reset email
const sendPasswordResetEmail = async (email, name, resetToken) => {
    try {
        const transporter = createTransporter();
        const resetUrl = `${process.env.FRONTEND_URL || 'https://edutrack.com'}/reset-password?token=${resetToken}`;
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'EduTrack'}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'EduTrack - Password Reset Request',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0;">Password Reset Request</h2>
          </div>

          <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
            <p style="font-size: 16px; color: #333; margin-bottom: 15px;">
              Hello ${name},
            </p>

            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;">
              You have requested to reset your password for your EduTrack account.
              Click the button below to reset your password:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                 style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>

            <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px;">
              This link will expire in 1 hour for security reasons.<br>
              If you didn't request this password reset, please ignore this email.
            </p>
          </div>
        </div>
      `,
            text: `
        Password Reset Request

        Hello ${name},

        You have requested to reset your password for your EduTrack account.
        Click the link below to reset your password:

        ${resetUrl}

        This link will expire in 1 hour for security reasons.
        If you didn't request this password reset, please ignore this email.
      `,
        };
        const info = await transporter.sendMail(mailOptions);
        setup_1.logger.info('Password reset email sent successfully', {
            email,
            messageId: info.messageId
        });
        return true;
    }
    catch (error) {
        setup_1.logger.error('Failed to send password reset email', {
            email,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
    }
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
// Test email configuration
const testEmailConnection = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        setup_1.logger.info('Email service connection verified successfully');
        return true;
    }
    catch (error) {
        setup_1.logger.error('Email service connection failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
    }
};
exports.testEmailConnection = testEmailConnection;
