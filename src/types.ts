export type ServerView = {
  id: string;
  name: string;
  server: string;
  trustedCertificate: boolean;
  selected: boolean;
  hasToken: boolean;
  username: string;
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
  units: string;
  thumbnail: string;
};

export type PartPage = {
  count: number;
  results: PartSummary[];
};

export type CategorySummary = {
  pk: number;
  name: string;
};

export type CategoryPage = {
  count: number;
  results: CategorySummary[];
};

export type RecordSummary = {
  pk: number;
  title: string;
  detail: string;
  trailing: string;
};

export type RecordPage = {
  count: number;
  results: RecordSummary[];
};

export type CommandFailure = {
  kind: string;
  message: string;
};
