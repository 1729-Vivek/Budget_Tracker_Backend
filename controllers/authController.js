const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/userModel');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || 'development-secret', {
    expiresIn: '7d',
  });

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
});

const getDuplicateFieldMessage = (error) => {
  if (error?.code !== 11000) {
    return null;
  }

  const duplicateField = Object.keys(error.keyPattern || {})[0];

  if (duplicateField === 'email') {
    return 'An account with that email already exists.';
  }

  if (duplicateField) {
    return `${duplicateField} already exists.`;
  }

  return 'A unique field already exists.';
};

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  console.log('SMTP_HOST:', process.env.SMTP_HOST);

  if (!host || !port || !from) {
    return null;
  }

  return {
    host,
    port,
    secure,
    from,
    auth: user && pass ? { user, pass } : undefined,
  };
};

const buildResetUrl = ({ rawToken, email }) => {
  const emailParam = encodeURIComponent(email);
  const tokenParam = encodeURIComponent(rawToken);
  const template = process.env.PASSWORD_RESET_URL;

  if (template) {
    return template
      .replace('{{token}}', tokenParam)
      .replace('{{email}}', emailParam);
  }

  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${baseUrl}/?mode=reset&token=${tokenParam}&email=${emailParam}`;
};

const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig) {
    console.log(`Password reset link for ${email}: ${resetUrl}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth,
  });

  await transporter.sendMail({
    from: smtpConfig.from,
    to: email,
    subject: 'Reset your Budget Tracker password',
    text: [
      `Hi ${name || 'there'},`,
      '',
      'We received a request to reset your Budget Tracker password.',
      `Use this link to set a new password: ${resetUrl}`,
      '',
      'This link expires in 1 hour.',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>Hi ${name || 'there'},</p>
      <p>We received a request to reset your Budget Tracker password.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });

  return true;
};

const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    return res.status(201).json({
      message: 'Registration successful.',
      token: generateToken(user._id),
      user: sanitizeUser(user),
    });
  } catch (error) {
    const duplicateFieldMessage = getDuplicateFieldMessage(error);

    if (duplicateFieldMessage) {
      return res.status(409).json({ message: duplicateFieldMessage });
    }

    return res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.status(200).json({
      message: 'Sign in successful.',
      token: generateToken(user._id),
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const requestPasswordReset = async (req, res) => {
  const email = req.body?.email?.toLowerCase()?.trim();

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        message: 'If an account exists for that email, a reset link has been sent.',
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetUrl = buildResetUrl({ rawToken, email: user.email });

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save({ validateBeforeSave: false });

    const emailSent = await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl,
    });

    const response = {
      message: 'If an account exists for that email, a reset link has been sent.',
    };

    if (!emailSent && process.env.NODE_ENV !== 'production') {
      response.debugResetUrl = resetUrl;
    }

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: 'Could not start password reset.' });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: 'Reset token and new password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ message: 'Password reset successful. Please sign in.' });
  } catch (error) {
    return res.status(500).json({ message: 'Could not reset password.' });
  }
};

const getCurrentUser = async (req, res) => {
  return res.status(200).json({ user: sanitizeUser(req.user) });
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  requestPasswordReset,
  resetPassword,
};
