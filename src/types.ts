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

export type PartParameter = {
  name: string;
  value: string;
  units: string;
};

export type LookupHit = {
  pk: number;
  name: string;
  pathstring: string;
};

export type PartWrite = {
  name: string;
  description: string;
  ipn: string;
  revision: string;
  keywords: string;
  link: string;
  category: number | null;
  defaultLocation: number | null;
  units: string;
  active: boolean;
  assembly: boolean;
  component: boolean;
  purchaseable: boolean;
  salable: boolean;
  trackable: boolean;
  isTemplate: boolean;
  virtual: boolean;
};

export type PartDetail = {
  pk: number;
  name: string;
  fullName: string;
  description: string;
  ipn: string;
  revision: string;
  thumbnail: string;
  image: string;
  units: string;
  active: boolean;
  assembly: boolean;
  component: boolean;
  purchaseable: boolean;
  salable: boolean;
  inStock: number;
  categoryName: string;
  categoryId: number | null;
  location: string;
  locationId: number | null;
  trackable: boolean;
  virtual: boolean;
  locked: boolean;
  keywords: string;
  link: string;
  notes: string;
  templatePk: number | null;
  templateName: string;
  templateThumbnail: string;
  variantCount: number;
  bomCount: number;
  usedInCount: number;
  supplierCount: number;
  attachmentCount: number;
  building: number;
  scheduledToBuild: number;
  canBuild: number | null;
  allocatedToBuild: number;
  requiredForBuild: number;
  allocatedToSales: number;
  requiredForSales: number;
  ordering: number;
  priceLabel: string | null;
  isTemplate: boolean;
  parameters: PartParameter[];
};

export type BomSubstitute = {
  pk: number;
  partId: number;
  partName: string;
};

export type BomLine = {
  pk: number;
  quantity: number;
  reference: string;
  note: string;
  allowVariants: boolean;
  inherited: boolean;
  optional: boolean;
  consumable: boolean;
  setupQuantity: number;
  attrition: number;
  roundingMultiple: number | null;
  validated: boolean;
  partId: number;
  partName: string;
  partThumbnail: string;
  subPartId: number;
  subPartName: string;
  subPartThumbnail: string;
  substitutes: BomSubstitute[];
};

export type BomPage = {
  count: number;
  results: BomLine[];
};

export type BomItemWrite = {
  part: number;
  subPart: number;
  quantity: number;
  reference: string;
  note: string;
  allowVariants: boolean;
  inherited: boolean;
  optional: boolean;
  consumable: boolean;
  setupQuantity: number;
  attrition: number;
  roundingMultiple: number | null;
};

export type SupplierPartSummary = {
  pk: number;
  sku: string;
  supplierName: string;
  partName: string;
  supplierImage: string;
  inStock: number;
};

export type SupplierPartPage = {
  count: number;
  results: SupplierPartSummary[];
};

export type SupplierPartDetail = {
  pk: number;
  sku: string;
  active: boolean;
  primary: boolean;
  inStock: number;
  partId: number;
  partName: string;
  supplierName: string;
  manufacturerName: string;
  mpn: string;
  packaging: string;
  packQuantity: string;
  link: string;
  note: string;
};

export type PartPriceDetail = {
  currency: string;
  priceRange: string;
  overrideMin: string;
  overrideMax: string;
  internalCost: string;
  variantCost: string;
  bomCost: string;
  purchasePrice: string;
  supplierPrice: string;
  salePrice: string;
  saleHistory: string;
};

export type PartStockItem = {
  pk: number;
  partName: string;
  location: string;
  quantity: string;
  thumbnail: string;
};

export type PartStockPage = {
  count: number;
  results: PartStockItem[];
};

export type CategorySummary = {
  pk: number;
  name: string;
  pathstring: string;
  partCount: number;
};

export type PartCategory = {
  pk: number;
  name: string;
  description: string;
  parentId: number | null;
  parentPath: string;
  partCount: number;
  subcategoryCount: number;
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
