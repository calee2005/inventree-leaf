export type ServerView = {
  id: string;
  name: string;
  server: string;
  trustedCertificate: boolean;
  selected: boolean;
  hasToken: boolean;
};

export type ServerInfo = {
  version: string;
  apiVersion: number;
  instance: string;
};

export type SessionUser = {
  pk: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type PartSummary = {
  pk: number;
  name: string;
  ipn: string;
  description: string;
  inStock: number;
};

export type PartPage = {
  count: number;
  results: PartSummary[];
};

export type CommandFailure = {
  kind: string;
  message: string;
};
