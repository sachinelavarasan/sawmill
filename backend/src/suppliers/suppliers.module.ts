import { Permission } from '@sawmill/shared';
import { partyModule } from '../common/party';
import { clients, suppliers } from '../db/schema';

/** [OWNER-ONLY] Who the mill buys logs from; picked on an import's purchase details. */
export const SuppliersModule = partyModule({ path: 'suppliers', table: suppliers, entityType: 'Supplier', permission: Permission.SUPPLIERS_MANAGE });

/** [OWNER-ONLY] Who the mill sells sawn wood to; picked on an export's sale details. */
export const ClientsModule = partyModule({ path: 'clients', table: clients, entityType: 'Client', permission: Permission.CLIENTS_MANAGE });
