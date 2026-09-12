export default class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  register = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { user, token } = await this.authService.registerUser(email, password);
      res.status(201).json({ user, token });
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
      res.status(200).json({ user, token });
    } catch (err) {
      if (err.message === 'Invalid credentials') {
        return res.status(401).json({ error: err.message });
      }
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
