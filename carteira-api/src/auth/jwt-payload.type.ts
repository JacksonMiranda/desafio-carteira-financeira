export type JwtPayload = {
  sub: string;
  email: string;
};

export type AuthenticatedUser = {
  userId: string;
  email: string;
};
