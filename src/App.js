import React, { useState, useEffect } from 'react';
import ReactDOM from "react-dom";
import { ethers, BrowserProvider } from 'ethers';
import LirABI from './LirABI.json';
import './App.css';
import QRCode from "react-qr-code";

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('0');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [contractBalance, setContractBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState([]);
  

  // Замените на ваш адрес контракта после деплоя
  const contractAddress = "0xA91461c7C857266565e35A026aeb0b5c4Ec94C16";

  // Подключение кошелька
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setIsLoading(true);
        const provider = new BrowserProvider(window.ethereum);
        
        // Проверяем, есть ли доступ к аккаунтам
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length === 0) {
          throw new Error("No accounts found");
        }
        
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        
        setProvider(provider);
        setSigner(signer);
        setAccount(address);
        
        // Инициализация контракта
        const lirContract = new ethers.Contract(contractAddress, LirABI, signer);
        setContract(lirContract);
        
        // Подписка на события
        setupContractListeners(lirContract);
        
        // Загрузка начальных данных
        await Promise.all([
          checkRoles(lirContract, address),
          updateBalances(lirContract, address)
        ]);
      } catch (error) {
        console.error("Error connecting wallet:", error);
        alert(`Connection error: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // Проверка ролей пользователя
  const checkRoles = async (contract, address) => {
    try {
      const [admin, isManager] = await Promise.all([
        contract.admin(),
        contract.managers(address)
      ]);
      setIsAdmin(admin.toLowerCase() === address.toLowerCase());
      setIsManager(isManager);
    } catch (error) {
      console.error("Error checking roles:", error);
    }
  };

  // Обновление балансов
  const updateBalances = async (contract, address) => {
    try {
      const [userBalance, contractBal] = await Promise.all([
        contract.balanceOf(address),
        contract.balanceOf(contractAddress)
      ]);
      setBalance(ethers.formatUnits(userBalance, 18));
      setContractBalance(ethers.formatUnits(contractBal, 18));
    } catch (error) {
      console.error("Error updating balances:", error);
    }
  };

  // Настройка слушателей событий контракта
  const setupContractListeners = (contract) => {
    contract.on("Transfer", (from, to, value, event) => {
      setEvents(prev => [...prev.slice(-9), {
        type: "Transfer",
        from,
        to,
        value: ethers.formatUnits(value, 18),
        txHash: event.transactionHash,
        timestamp: new Date().toLocaleTimeString()
      }]);
    });
  };

  // Обработчик транзакций (универсальный)
  const handleTransaction = async (txFunction, successMessage) => {
    if (!contract) return false;
    
    try {
      setIsLoading(true);
      const tx = await txFunction();
      await tx.wait();
      alert(successMessage);
      await updateBalances(contract, account);
      return true;
    } catch (error) {
      console.error("Transaction error:", error);
      alert(`Error: ${error.reason || error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Функции контракта
  const setManager = async (managerAddress, status) => {
    await handleTransaction(
      () => contract.setManager(managerAddress, status),
      `Manager ${managerAddress} status set to ${status}`
    );
  };

  const distributeToManager = async (managerAddress, amount) => {
    await handleTransaction(
      () => contract.distributeToManager(managerAddress, ethers.parseUnits(amount, 18)),
      `Distributed ${amount} LIR to manager ${managerAddress}`
    );
  };

  const rewardStudent = async (studentAddress, amount) => {
    await handleTransaction(
      () => contract.rewardStudent(studentAddress, ethers.parseUnits(amount, 18)),
      `Rewarded ${amount} LIR to student ${studentAddress}`
    );
  };

  const burnTokens = async (amount) => {
    await handleTransaction(
      () => contract.burnTokens(ethers.parseUnits(amount, 18)),
      `Burned ${amount} LIR tokens`
    );
  };

  // Автоподключение при наличии активной сессии
  useEffect(() => {
    if (window.ethereum) {
      const checkConnected = async () => {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          connectWallet();
        }
      };
      checkConnected();
    }
  }, []);

  // Очистка слушателей при размонтировании
  useEffect(() => {
    return () => {
      if (contract) {
        contract.removeAllListeners();
      }
    };
  }, [contract]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>LIR Token</h1>
        
        {!account ? (
          <button 
            onClick={connectWallet} 
            disabled={isLoading}
            className="connect-button"
          >
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </button>
        ) : (
          <div className="dashboard">
            <div className="account-info">
              <h2>Account Information</h2>
              <QRCode
                size={256}
                style={{ height: "auto", maxWidth: "100%", width: "25%" }}
                value={account}
                viewBox={`0 0 256 256`}
              />
              <p><strong>Address:</strong> {shortenAddress(account)}</p>
              <p><strong>Your balance:</strong> {balance} LIR</p>
              <p><strong>Contract balance:</strong> {contractBalance} LIR</p>
              
              <div className="status-badges">
                {isAdmin && <span className="badge admin">ADMIN</span>}
                {isManager && <span className="badge manager">MANAGER</span>}
              </div>
            </div>
            
            <div className="transaction-history">
              <h2>Recent Transactions</h2>
              {events.length === 0 ? (
                <p>No transactions yet</p>
              ) : (
                <ul>
                  {events.map((event, index) => (
                    <li key={index}>
                      [{event.timestamp}] {event.type}: {event.value} LIR from {shortenAddress(event.from)} to {shortenAddress(event.to)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Admin functions */}
            {isAdmin && (
              <div className="admin-section section">
                <h2>Admin Functions</h2>
                <ManagerForm onSetManager={setManager} isLoading={isLoading} />
                <DistributeForm onDistribute={distributeToManager} isLoading={isLoading} />
              </div>
            )}
            
            {/* Manager functions */}
            {isManager && (
              <div className="manager-section section">
                <h2>Manager Functions</h2>
                <RewardForm onReward={rewardStudent} isLoading={isLoading} />
              </div>
            )}
            
            {/* User functions */}
            <div className="user-section section">
              <h2>User Functions</h2>
              <BurnForm onBurn={burnTokens} isLoading={isLoading} maxAmount={balance} />
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

// Компоненты форм
function ManagerForm({ onSetManager, isLoading }) {
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ethers.isAddress(address)) {
      alert("Please enter a valid Ethereum address");
      return;
    }
    await onSetManager(address, status);
    setAddress('');
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h3>Set Manager Status</h3>
      <div className="form-group">
        <label>Manager Address:</label>
        <input 
          type="text" 
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          required
        />
      </div>
      <div className="form-group checkbox">
        <label>
          <input 
            type="checkbox" 
            checked={status}
            onChange={(e) => setStatus(e.target.checked)}
          />
          Grant Manager Role
        </label>
      </div>
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Processing..." : "Set Manager"}
      </button>
    </form>
  );
}

function DistributeForm({ onDistribute, isLoading }) {
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ethers.isAddress(address)) {
      alert("Please enter a valid Ethereum address");
      return;
    }
    if (isNaN(amount) || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    await onDistribute(address, amount);
    setAddress('');
    setAmount('');
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h3>Distribute Tokens</h3>
      <div className="form-group">
        <label>Manager Address:</label>
        <input 
          type="text" 
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          required
        />
      </div>
      <div className="form-group">
        <label>Amount (LIR):</label>
        <input 
          type="number" 
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          min="0"
          step="0.1"
          required
        />
      </div>
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Processing..." : "Distribute Tokens"}
      </button>
    </form>
  );
}

function RewardForm({ onReward, isLoading }) {
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ethers.isAddress(address)) {
      alert("Please enter a valid Ethereum address");
      return;
    }
    if (isNaN(amount) || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    await onReward(address, amount);
    setAddress('');
    setAmount('');
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h3>Reward Student</h3>
      <div className="form-group">
        <label>Student Address:</label>
        <input 
          type="text" 
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          required
        />
      </div>
      <div className="form-group">
        <label>Amount (LIR):</label>
        <input 
          type="number" 
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10"
          min="0"
          step="0.1"
          required
        />
      </div>
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Processing..." : "Reward Student"}
      </button>
    </form>
  );
}

function BurnForm({ onBurn, isLoading, maxAmount }) {
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isNaN(amount) || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (Number(amount) > Number(maxAmount)) {
      alert(`You cannot burn more than your balance (${maxAmount} LIR)`);
      return;
    }
    await onBurn(amount);
    setAmount('');
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h3>Burn Tokens</h3>
      <div className="form-group">
        <label>Amount to Burn (LIR):</label>
        <input 
          type="number" 
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Max: ${maxAmount}`}
          min="0"
          max={maxAmount}
          step="0.1"
          required
        />
      </div>
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Processing..." : "Burn Tokens"}
      </button>
    </form>
  );
}

// Вспомогательная функция для сокращения адресов
function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default App;