import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';


export type MasterConfig = {
    total_supply: number;
    admin_address: Address;
    share_rate: number;

};

export function masterConfigToCell(config: MasterConfig): Cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(config.admin_address)
        .storeCoins(0)
        .endCell();
}

export class Master implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) { }

    static createFromAddress(address: Address) {
        return new Master(address);
    }

    static createFromConfig(config: MasterConfig, code: Cell, workchain = 0) {
        const data = masterConfigToCell(config);
        const init = { code, data };
        return new Master(contractAddress(workchain, init), init);
    }

    async send_withdrawal_order(provider: ContractProvider, via: Sender, value: bigint , withdraw_amount:number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(2, 32).storeUint(withdraw_amount, 32).endCell(),
        });
    }

    async getData(provider: ContractProvider) {
        const { stack } = await provider.get("get_contract_data", []);
        return {
            total_sup:stack.readNumber(),  
            admin_address: stack.readAddress(),
            share_ratio:stack.readNumber(),         
        };
    }

    async getBalance(provider: ContractProvider) {
        const { stack } = await provider.get("balance", []);
        return {
            number: stack.readNumber(),
        }
    }
}

