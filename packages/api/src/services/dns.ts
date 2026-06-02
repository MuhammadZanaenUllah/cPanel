import { dbAdmin } from '../db/connection';
import 'dotenv/config';

export class DnsService {
  static async addZone(domainName: string, ipAddress: string) {
    const ns1 = process.env.NAMESERVER_1 || 'ns1.cpanelclone.local';
    const ns2 = process.env.NAMESERVER_2 || 'ns2.cpanelclone.local';

    // 1. Insert domain
    let domainId: number;
    const existing = await dbAdmin('powerdns.domains').where({ name: domainName }).first();
    
    if (!existing) {
      const [insertedId] = await dbAdmin('powerdns.domains').insert({
        name: domainName,
        type: 'MASTER'
      });
      domainId = insertedId;
    } else {
      domainId = existing.id;
    }

    // 2. Insert DNS Records
    const records = [
      { domain_id: domainId, name: domainName, type: 'SOA', content: `${ns1} hostmaster.${domainName} 2026060201 10800 3600 604800 3600`, ttl: 86400, prio: null },
      { domain_id: domainId, name: domainName, type: 'NS', content: ns1, ttl: 86400, prio: null },
      { domain_id: domainId, name: domainName, type: 'NS', content: ns2, ttl: 86400, prio: null },
      { domain_id: domainId, name: domainName, type: 'A', content: ipAddress, ttl: 3600, prio: null },
      { domain_id: domainId, name: `www.${domainName}`, type: 'CNAME', content: domainName, ttl: 3600, prio: null },
      { domain_id: domainId, name: `mail.${domainName}`, type: 'A', content: ipAddress, ttl: 3600, prio: null },
      { domain_id: domainId, name: domainName, type: 'MX', content: `mail.${domainName}`, ttl: 3600, prio: 10 }
    ];

    await dbAdmin('powerdns.records').insert(records);
  }

  static async removeZone(domainName: string) {
    const domain = await dbAdmin('powerdns.domains').where({ name: domainName }).first();
    if (domain) {
      await dbAdmin('powerdns.records').where({ domain_id: domain.id }).del();
      await dbAdmin('powerdns.domains').where({ id: domain.id }).del();
    }
  }
}
