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
  pluginsEnabled: boolean | null;
  workerRunning: boolean | null;
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
  testable: boolean;
  consumable: boolean;
  locked: boolean;
  copyCategoryParameters: boolean;
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
  testable: boolean;
  consumable: boolean;
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
  subPartUnits: string;
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

export type SupplierPartWrite = {
  part: number;
  supplier: number;
  sku: string;
  description: string;
  packaging: string;
  packQuantity: string;
  link: string;
  note: string;
  active: boolean;
  primary: boolean;
};

export type SupplierPartSummary = {
  pk: number;
  sku: string;
  supplierName: string;
  partName: string;
  supplierImage: string;
  partThumbnail: string;
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
  supplierId: number;
  supplierName: string;
  manufacturerId: number;
  manufacturerName: string;
  manufacturerPartId: number | null;
  mpn: string;
  packaging: string;
  packQuantity: string;
  link: string;
  note: string;
};

export type CompanyWrite = {
  name: string;
  description: string;
  website: string;
  phone: string;
  email: string;
  contact: string;
  link: string;
  currency: string;
  taxId: string;
  notes: string;
  active: boolean;
  isSupplier: boolean;
  isManufacturer: boolean;
  isCustomer: boolean;
};

export type CompanySummary = {
  pk: number;
  name: string;
  description: string;
  thumbnail: string;
  active: boolean;
};

export type CompanyDetail = CompanySummary & {
  website: string;
  phone: string;
  email: string;
  link: string;
  currency: string;
  contact: string;
  notes: string;
  taxId: string;
  address: string;
  isSupplier: boolean;
  isManufacturer: boolean;
  isCustomer: boolean;
  partsSupplied: number;
  partsManufactured: number;
};

export type CompanyPage = {
  count: number;
  results: CompanySummary[];
};

export type ManufacturerPartSummary = {
  pk: number;
  mpn: string;
  partName: string;
  thumbnail: string;
};

export type ManufacturerPartDetail = {
  pk: number;
  mpn: string;
  description: string;
  manufacturerId: number;
  manufacturerName: string;
  partId: number;
  partName: string;
  link: string;
  notes: string;
};

export type PurchaseOrderSummary = {
  pk: number;
  reference: string;
  description: string;
  statusText: string;
  supplierName: string;
  thumbnail: string;
};

export type PurchaseOrderDetail = {
  pk: number;
  reference: string;
  description: string;
  statusText: string;
  supplierId: number | null;
  supplierName: string;
  supplierReference: string;
  totalPrice: string;
  currency: string;
  issueDate: string;
  startDate: string;
  targetDate: string;
  completeDate: string;
  lineCount: number;
  completedLines: number;
  notes: string;
  link: string;
};

export type PurchaseOrderLine = {
  pk: number;
  sku: string;
  partName: string;
  supplierPartId: number | null;
  quantity: number;
  received: number;
  price: string;
  targetDate: string;
};

export type PurchaseOrderExtraLine = {
  pk: number;
  description: string;
  price: string;
};

export type SalesOrderSummary = {
  pk: number;
  reference: string;
  description: string;
  statusText: string;
  customerName: string;
  thumbnail: string;
};

export type SalesOrderDetail = {
  pk: number;
  reference: string;
  description: string;
  statusText: string;
  customerId: number | null;
  customerName: string;
  customerReference: string;
  totalPrice: string;
  currency: string;
  issueDate: string;
  startDate: string;
  targetDate: string;
  shipmentDate: string;
  lineCount: number;
  completedLines: number;
  shipmentCount: number;
  completedShipments: number;
  notes: string;
  link: string;
};

export type SalesOrderLine = {
  pk: number;
  partId: number | null;
  partName: string;
  thumbnail: string;
  quantity: number;
  shipped: number;
  price: string;
};

export type SalesOrderShipment = {
  pk: number;
  reference: string;
  trackingNumber: string;
  invoiceNumber: string;
  shipmentDate: string;
  deliveryDate: string;
  checked: boolean;
  notes: string;
  link: string;
  orderId: number | null;
};

export type OrderSummary = {
  pk: number;
  reference: string;
  description: string;
  statusText: string;
  detail: string;
  thumbnail: string;
};

export type BuildDetail = {
  pk: number;
  reference: string;
  title: string;
  statusText: string;
  partId: number | null;
  partName: string;
  partThumbnail: string;
  quantity: number;
  completed: number;
  batch: string;
  external: boolean;
  sourceId: number | null;
  sourceName: string;
  destinationId: number | null;
  destinationName: string;
  salesOrderId: number | null;
  creationDate: string;
  startDate: string;
  targetDate: string;
  completionDate: string;
  notes: string;
  link: string;
};

export type BuildLine = {
  pk: number;
  partId: number | null;
  partName: string;
  thumbnail: string;
  quantity: number;
  allocated: number;
  consumed: number;
  reference: string;
  notes: string;
};

export type BuildAllocation = {
  pk: number;
  stockItemId: number | null;
  partName: string;
  thumbnail: string;
  location: string;
  quantity: number;
};

export type TransferOrderDetail = {
  pk: number;
  reference: string;
  description: string;
  statusText: string;
  sourceId: number | null;
  sourceName: string;
  destinationId: number | null;
  destinationName: string;
  consume: boolean;
  lineCount: number;
  completedLines: number;
  creationDate: string;
  startDate: string;
  targetDate: string;
  completionDate: string;
  notes: string;
  link: string;
};

export type TransferLine = {
  pk: number;
  partId: number | null;
  partName: string;
  thumbnail: string;
  quantity: number;
  transferred: number;
  allocated: number;
  reference: string;
  targetDate: string;
  notes: string;
};

export type TransferAllocation = {
  pk: number;
  stockItemId: number | null;
  partName: string;
  thumbnail: string;
  location: string;
  serial: string;
  quantity: number;
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

export type StockLocationSummary = {
  pk: number;
  name: string;
  description: string;
  pathstring: string;
  itemCount: number;
};

export type StockLocationDetail = StockLocationSummary & {
  parentId: number | null;
  parentPath: string;
  structural: boolean;
  external: boolean;
};

export type StockLocationWrite = {
  name: string;
  description: string;
  parent: number | null;
  structural: boolean;
  external: boolean;
};

export type StockItemWrite = {
  part: number;
  location: number | null;
  quantity: number;
  serial: string;
  status: number;
  batch: string;
  packaging: string;
  link: string;
};

export type StockItemDetail = {
  pk: number;
  partId: number;
  partName: string;
  partDescription: string;
  partThumbnail: string;
  quantity: number;
  units: string;
  serial: string;
  batch: string;
  statusText: string;
  status: number;
  inStock: boolean;
  locationId: number | null;
  location: string;
  packaging: string;
  link: string;
  supplierPartId: number | null;
  supplierSku: string;
  updated: string;
  stocktakeDate: string;
};

export type StockItemPage = {
  count: number;
  results: StockItemDetail[];
};

export type StockLocationPage = {
  count: number;
  results: StockLocationSummary[];
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
