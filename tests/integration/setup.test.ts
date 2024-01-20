import { expect } from "chai";
import { Provider, Wallet } from "../../src";
import { ethers, BigNumber } from "ethers";
import { ETH_ADDRESS, ETH_ADDRESS_IN_CONTRACTS } from "../../src/utils";

import {
    ITestnetErc20TokenFactory,
} from "../../typechain/ITestnetErc20TokenFactory";

const DAI = require("../token.json");

// This should be run first before all other tests,
// which is why it's specified first in the test command in package.json.
describe("setup",  () => {
    const PRIVATE_KEY = "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110";

    const provider = Provider.getDefaultProvider();
    const ethProvider = ethers.getDefaultProvider("http://localhost:8545");

    const wallet = new Wallet(PRIVATE_KEY, provider, ethProvider);

    it("should mint funds if needed", async () => {
        const bridgehub = await  wallet.getBridgehubContract();
        const chainId = (await wallet._providerL2().getNetwork()).chainId;
        let baseTokenAddress = await bridgehub.baseToken(chainId);
        baseTokenAddress = (baseTokenAddress == ETH_ADDRESS_IN_CONTRACTS) ? ETH_ADDRESS : baseTokenAddress;
        if (baseTokenAddress == ETH_ADDRESS) {return}
        
        const testnetToken = ITestnetErc20TokenFactory.connect(baseTokenAddress, wallet._signerL1());
        const tx = await testnetToken.mint(await wallet.getAddress(), BigNumber.from("1000000000000000000000000"));
        await tx.wait();
        
        const altToken = ITestnetErc20TokenFactory.connect(DAI.l1Address, wallet._signerL1());
        const tx2 = await altToken.mint(await wallet.getAddress(), BigNumber.from("1000000000000000000000000"));
        await tx2.wait();
        
        const wethBridgeAbi = ['function l1WethAddress() view returns (address)'];
        const wethBridge = new ethers.Contract((await wallet.provider.getDefaultBridgeAddresses()).wethL1!, wethBridgeAbi, wallet._signerL1());
        const wethAbi = ['function deposit() public payable'];
        const weth = new ethers.Contract(await wethBridge.l1WethAddress(),wethAbi,  wallet._signerL1());
        const tx3 = await weth.deposit({value: BigNumber.from("10000000000000000000000")});
        await tx3.wait();
    }).timeout(25_000);

    it("deploy DAI token on L2 if not exists using deposit", async () => {
        const l2DAI = await provider.getCode(await provider.l2TokenAddress(DAI.l1Address));
        if (l2DAI === "0x") {
            const priorityOpResponse = await wallet.deposit({
                token: DAI.l1Address,
                to: await wallet.getAddress(),
                amount: 30,
                approveERC20: true,
                approveBaseERC20: true,
                refundRecipient: await wallet.getAddress(),
            });
            const receipt = await priorityOpResponse.waitFinalize();
            expect(receipt).not.to.be.null;
        }
    }).timeout(35_000);

    it("should send funds to l2", async () => {
        const bridgehub = await  wallet.getBridgehubContract();
        const chainId = (await wallet._providerL2().getNetwork()).chainId;
        let baseTokenAddress = await bridgehub.baseToken(chainId);
        baseTokenAddress = (baseTokenAddress == ETH_ADDRESS_IN_CONTRACTS) ? ETH_ADDRESS : baseTokenAddress;

        const priorityOpResponse = await wallet.deposit({
            token: baseTokenAddress,
            to: await wallet.getAddress(),
            amount: BigNumber.from("33472850000000000")
            ,
            approveERC20: true,
            refundRecipient: await wallet.getAddress(),
        });
        const receipt = await priorityOpResponse.waitFinalize();
        expect(receipt).not.to.be.null;
    }).timeout(75_000);
});
