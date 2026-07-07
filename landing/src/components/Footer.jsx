import React from 'react';
import { Paintbrush, Globe, MessageCircle, Mail } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-background/80 py-12 px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2 group cursor-pointer">
          <Paintbrush className="w-5 h-5 text-accent group-hover:rotate-12 transition-transform duration-300" />
          <span className="font-bold text-lg tracking-tight">Igloo<span className="text-accent">AI</span></span>
        </div>

        <div className="flex items-center gap-6 text-white/50">
          <a href="#" className="hover:text-white transition-colors duration-300"><Globe className="w-5 h-5" /></a>
          <a href="#" className="hover:text-white transition-colors duration-300"><MessageCircle className="w-5 h-5" /></a>
          <a href="#" className="hover:text-white transition-colors duration-300"><Mail className="w-5 h-5" /></a>
        </div>
      </div>
      <div className="mt-8 text-center text-white/30 text-sm">
        &copy; {new Date().getFullYear()} IglooAI Inc. All rights reserved. Award-winning design.
      </div>
    </footer>
  );
};

export default Footer;
