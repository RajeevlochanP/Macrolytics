export default class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  _setTokenCookie(res, token) {
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'strict', 
      maxAge: 86400000 
    });
  }

  register = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { user, token } = await this.authService.registerUser(email, password);
      this._setTokenCookie(res, token);
      res.status(201).json({ user });
    } catch (err) {
      if (err.message === 'User already exists') {
        return res.status(409).json({ error: err.message });
      }
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  login = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { user, token } = await this.authService.loginUser(email, password);
      this._setTokenCookie(res, token);
      res.status(200).json({ user });
    } catch (err) {
      if (err.message === 'Invalid credentials') {
        return res.status(401).json({ error: err.message });
      }
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  logout = (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });
  };
}
