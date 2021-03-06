import React, { useState, useEffect } from 'react';
// import DeckPreview from '../components/DeckPreview';
import useInterval from '../components/UseInterval'
import { Link } from 'react-router-dom';
import Loading from '../components/Loading';
import "../css/creator.css";
import { ethers } from "ethers";
import PoolAritfact from "../contracts/Pool.json";
import axios from 'axios';
import db from '../components/firestore';
import { useHistory } from "react-router-dom";
import { tokens } from "../components/tokens";
// import contractAddress from "../contracts/contract-address.json";






/**
 * Home page that contains a grid of decks, a search bar,
 * and a filter button
 */
function Creator(props: {poolFactory: ethers.Contract, 
                         provider: ethers.providers.Web3Provider,
                         connectedAddress: string,
                         initialized: boolean}) {


    // const[creatorLoaded, setCreatorLoaded] = useState(false);
    const[walletBalance, setWalletBalance] = useState<number>(0);
    const[inputAmount, setInputAmount] = useState<number>(0);
    const[depositBalance, setDepositBalance] = useState<number>(0);
    const[depositBalanceETH, setDepositBalanceETH] = useState<number>(0);
    const[poolContract, setPoolContract] = useState<ethers.Contract>();
    const[poolBalance, setPoolBalance] = useState<number>(0);
    const[dataLoaded, setDataLoaded] = useState<boolean>(false);
    const[displayName, setDisplayName] = useState<string>("");
    const[bio, setBio] = useState<string>("");
    const[links, setLinks] = useState<string[]>([]);
    const[poolAddress, setPoolAddress] = useState<string>("");
    const[isOwner, setIsOwner] = useState<boolean>(false);
    const[creatorBalance, setCreatorBalance] = useState<number>(0); 
    const[networkId, setNetworkId] = useState<number>(-1);
    const history = useHistory();

    async function initialize() {

        if (props.initialized === false)
            return;

        // no wallet connected
        if (props.provider === undefined) {
            // load the creator's data
            await getCreatorData();
            setDataLoaded(true);
            return;
        }

        // load the creator's data
        getCreatorData();

        // set network ID
        setNetworkId(props.provider._network.chainId);

        if (poolAddress === "")
            return;

        // get wallet balance in bigint format
        let bal = await props.provider.getBalance(props.connectedAddress);

        const pools = await props.poolFactory.getPools();

        if (pools.length === 0)
            return;

        // setup contract
        const contract = new ethers.Contract(
            poolAddress,
            PoolAritfact.abi,
            props.provider.getSigner(0)
        );

        // set the pool contract
        setPoolContract(contract);

        // set pool values
        getPoolBalance(contract);
        getDepositBalance(contract);


        // convert to ETH and float then update state
        setWalletBalance(parseFloat(ethers.utils.formatEther(bal)));


    }


    // return the amount of money pooled
    async function getPoolBalance(contract: ethers.Contract) {
        
        // get user balance
        // let bal = await contract.getTotalBalance();

        // setup contract
        const aDAI = new ethers.Contract(
            tokens.aDAI.address,
            tokens.aDAI.abi,
            props.provider.getSigner(0)
        );

        // get contract balance of aDAI
        let bal = await aDAI.balanceOf(contract.address);

        // is the user the owner of the pool
        // TODO: it may be safe to not do this clientside
        // I'm not sure if people can just impersonate other wallets
        if (isOwner) {
            // get the creators balance
            let cBal = await contract.getCreatorBalance();
            cBal = ethers.utils.formatEther(cBal.toString());
            setCreatorBalance(parseFloat(cBal));
        }

        // set balance
        setPoolBalance(parseFloat(ethers.utils.formatEther(bal.toString())));

        setDataLoaded(true);

    }

    // return the amount of stablecoin the user has deposited
    async function getDepositBalance(contract: ethers.Contract) {

        // get user balance
        const bal = await contract.balanceOf(props.connectedAddress);
        const formattedBal = parseFloat(ethers.utils.formatEther(bal.toString()));

        // weth address
        let weth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

        // get price of eth
        const priceRequest = await axios.get('https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2&vs_currencies=usd')
        const price = parseFloat(priceRequest.data[weth].usd);

        // set balance
        setDepositBalance(formattedBal);

        if (formattedBal > 0)
            setDepositBalanceETH(price/formattedBal)


        return bal;

    }


    useInterval(() => {

          if (poolContract !== undefined) {
            getPoolBalance(poolContract);
            getDepositBalance(poolContract);
          } else {
              initialize();
          }

    }, 1000)

    // run on load
    useEffect(() => {

    }, [poolBalance, networkId]);

    // get latest gas prices 
    async function getGasPrice(speed?: string) {
        
        // make request w/ axios
        const price = await axios.get('https://ethgasstation.info/api/ethgasAPI.json?api-key=' + process.env.DEFI_PULSE_KEY)

        if (speed === "fastest")
            return(parseInt(price.data.fastest)/10);
        else if (speed === "fast")
            return(parseInt(price.data.fast)/10);
        else 
            return(parseInt(price.data.average)/10);

    }

    // load the creator data from firebase
    // returns address of creator
    function getCreatorData() {

        // get the deck id from the URL
        let addr = window.location.pathname;
        addr = addr.substr(addr.lastIndexOf("/") + 1);

        // check if addr is valid. if not use default
        if (addr.length !== 42 && props.connectedAddress === "") {
            // addr = "0x39a7baa3fcb68ad38377ea4ebb402296dd69d981";
            history.push("/new-creator/");
        } else if (addr.length !== 42 && props.connectedAddress !== "") {
            // load the account based on the connected wallet if it is connected
            addr = props.connectedAddress;
            history.push("/creator/" + props.connectedAddress);
        }

        // check if this is the owner's page
        if (addr.toLocaleLowerCase() === props.connectedAddress.toLowerCase())
            setIsOwner(true);

        var ref = db.collection("users").doc(addr);

        ref.get().then(function(doc) {
            if (doc.exists) {

                // get the data
                let data = doc.data();

                // return if data is undefined 
                if (data === undefined)
                 return;

                // update state vars
                setDisplayName(data.name);
                setBio(data.bio);
                setPoolAddress(data.pool);
                setLinks(data.links);

            } else {
                // doc.data() will be undefined in this case
                console.log("No such document!");
            }
        }).catch(function(error) {
            console.log("Error getting document:", error);
        });
        
    }


    // deposit into pool
    async function depositClicked () {

        // no can do
        if (inputAmount === 0 || inputAmount > walletBalance || poolContract === undefined)
            return;

        // convert amount to wei 
        const value = ethers.utils.parseEther(inputAmount.toString());

        // get current gas prices
        const gasPrice = await getGasPrice();

        // deposit amount
        await poolContract.deposit({value: value, gasLimit:900000, gasPrice: 10 * 1e9});

    }

    // withdraw from pool
    async function withdrawClicked() {

        // no can do
        if (inputAmount === 0  || poolContract === undefined)
            return;

        // convert amount to wei 
        // const value = ethers.utils.parseEther(inputAmount.toString());

        let userBalance = await getDepositBalance(poolContract);
        // console.log("withdrawing: ", userBalance);

        // get current gas prices
        const gasPrice = await getGasPrice();

        // deposit amount
        await poolContract.withdraw(userBalance, {gasLimit:900000, gasPrice: 10 * 1e9});

    }

    // withdraw creator's deposit from ppol
    async function creatorWithdrawClicked() {

        // no can do
        if (poolContract === undefined)
            return;

        // get the amount to withdraw
        let amount = ethers.utils.parseEther(creatorBalance.toString());


        // get current gas prices
        const gasPrice = await getGasPrice();

        // deposit amount
        await poolContract.creatorWithdraw(amount, {gasLimit:900000, gasPrice: 10 * 1e9});

    }

    if (dataLoaded && props.initialized) {
        return (
            <div className="page-wrapper">
                <div className="creator-wrapper">
                    <div className="creator-header">
                        <span className="pool-balance">Money Pooled: ${poolBalance.toFixed(5)} USD</span>
                        <Link to="/new-creator" className="register">Create your own page here</Link>
                    </div>    
                    <div className="creator-profile">
                        <div className="creator-info">
                            <div className="info-top">
                                <span className="creator-name">{displayName}</span> 
                                <a rel="noopener noreferrer" target="_blank" href={"https://kovan.etherscan.io/address/" + poolAddress}>(View on Etherscan)</a>
                            </div>
                            <div className="info-bottom">
                                <span className="creator-bio">{bio}</span>
                            {isOwner ? 
                                <div className="creator-withdraw-wrapper">
                                    <span className="creator-withdraw"onClick={creatorWithdrawClicked} >Available for withdraw: ${creatorBalance} USD</span>
                                </div>
                            :
                                <div></div>
                            }
                            </div>
                        </div>
                    </div>
                    <div className="creator-middle">
                        <div className="creator-links middle-section">
                            <h2>MY LINKS</h2>
                            <div className="middle-text">
                                <ul>
                                    {links.map((link, i) => (<li key={i}><a rel="noopener noreferrer" target="_blank" href={link}>{link}</a></li>))} 
                                </ul>
                            </div>
                        </div>
                        <div className="creator-explain middle-section">
                            <h2>HOW THIS WORKS</h2>
                            <div className="middle-text">
                                <span>
                                    <b>Lump.Finance</b> is a platform that allows fans to financially support their 
                                    favorite creators without spending any money. Through the magic of <a rel="noopener noreferrer" target="_blank" href="https://ethereum.org/en/">Ethereum</a> and <a rel="noopener noreferrer" target="_blank" href="https://aave.com/"> AAVE's Lending Pools</a>, fans 
                                    can <b>lump</b> their funds together in a pool that generates interest to be collected by the creator. At any point fans can withdraw nearly 100% of their deposit (some is lost from Ethereum transaction fees)
                                    and creators can withdraw the accrued interest whenever needed without touching the money deposited by their fans.
                                </span>
                            </div>
                        </div>
                    </div>
                    {props.connectedAddress !== "" ? 
                        <div className="creator-actions">
                            <div className="input-wrapper">
                                <input type="number" className="input-amount" placeholder="Insert Amount in ETH" onChange={(e) => {setInputAmount(parseFloat(e.target.value))}}></input>
                                <span className="balance-amount">Wallet Balance: {walletBalance.toFixed(2)} ETH</span>
                                <span className="balance-amount">Your Deposit: ${depositBalance.toFixed(2)} USD</span>
                            </div>
                            <div className="button-wrapper">
                                <button className="btn-deposit" onClick={depositClicked}>Deposit</button>
                                <button className="btn-withdraw" onClick={withdrawClicked}>Withdraw</button>
                            </div>
                        </div>
                    :
                        <div className="creator-actions dark">
                            <span>Connect your wallet to pool!</span>
                        </div>
                    }
                </div>
            </div>
        );
    } else {
        return(<Loading/>);
    }
    
}

export default Creator;

