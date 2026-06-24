// Define variáveis de ambiente antes de qualquer import NestJS. O ConfigModule
// não sobrescreve valores já presentes em process.env, então basta setá-los aqui
// para que toda a aplicação use o banco e segredos de teste.
process.env.DATABASE_URL =
  'postgresql://carteira:carteira@localhost:5432/carteira?schema=e2e';
process.env.JWT_SECRET = 'test-secret-e2e';
process.env.JWT_EXPIRES_IN = '1h';
