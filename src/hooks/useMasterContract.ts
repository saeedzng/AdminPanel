import { useEffect, useState } from "react";
import { Master } from "../contracts/Master";
import { useTonClient } from "./useTonClient";
import { useAsyncInitialize } from "./useAsyncInitialize";
import { Address, OpenedContract } from 'ton-core';
import { toNano } from "ton-core";
import { useTonConnect } from "./useTonConnect";

export function useMasterContract() {

  const client = useTonClient();
  const { sender } = useTonConnect();
  const [contractData, setContractData] = useState<null | { owner_address: Address ; total_supply: number ; share_rate:number}>();
  const [balance, setBalance] = useState<null | number>(0);
  const masterContract = useAsyncInitialize(async () => {
    if (!client) return;
    const contract = new Master(
      Address.parse("kQD_VDXfdjRq2Nm-NOW3HwM4BFK6XBh6-8NUg4roLamJVf1s") 
    );
    return client.open(contract) as OpenedContract<Master>;
  }, [client]);

  useEffect(() => {
    async function getValue() {
      if (!masterContract) return;
      setContractData(null);
      const val = await masterContract.getData();
      const balance = await masterContract.getBalance();
      setContractData({ owner_address: val.admin_address , total_supply:val.total_sup , share_rate:val.share_ratio  });
      setBalance(balance.number);
    }
    getValue();
  }, [masterContract]);
  
  return {
    master_contract_address: masterContract?.address.toString(),
    master_contract_balance: balance,
    ...contractData,
    send_withdraw_order: (withdraw_amount:number) => {
      return masterContract?.send_withdrawal_order(sender, toNano(0.02),withdraw_amount);
    }
  };
}
