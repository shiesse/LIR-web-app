// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Lir is ERC20 {
    address public admin;
    uint256 public totalSupplyLimit = 10000 * 10 ** decimals();

    mapping(address => bool) public managers;

    constructor() ERC20("Lir", "SCH") {
        admin = msg.sender;
        _mint(address(this), totalSupplyLimit); // Все токены изначально на контракте
    }

    // Назначение/удаление ответственного лица (может вызывать только админ)
    function setManager(address manager, bool status) external onlyAdmin {
        managers[manager] = status;
    }

    // Админ раздаёт токены ответственным лицам
    function distributeToManager(address manager, uint256 amount) external onlyAdmin {
        require(managers[manager], "Not a manager");
        _transfer(address(this), manager, amount);
    }

    // Ответственное лицо вознаграждает ученика
    function rewardStudent(address student, uint256 amount) external {
        require(managers[msg.sender], "Not a manager");
        _transfer(msg.sender, student, amount);
    }

    // Любой пользователь может сжечь свои токены
    function burnTokens(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
}