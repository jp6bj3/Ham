import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const SearchBar = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // 將搜尋字串轉換為小寫，以實現大小寫不敏感的搜尋
    onSearch(value.toLowerCase());
  };

  return (
    <div className="relative w-full max-w-md text-sm">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          type="text"
          placeholder="搜尋產品編號或名稱..."
          value={searchTerm}
          onChange={handleSearch}
          className="pl-8 w-full"
        />
      </div>
    </div>
  );
};

export default SearchBar;