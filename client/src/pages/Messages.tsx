import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BottomNavigation from "@/components/BottomNavigation";
import { MessageCircle, Send, Search } from "lucide-react";

export default function Messages() {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock conversations for now - would be replaced with real data
  const conversations = [];

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 p-4">
        <h1 className="text-2xl font-bold mb-4" data-testid="text-messages-title">Messages</h1>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-gray-400"
            data-testid="input-search-messages"
          />
        </div>
      </div>

      {/* Messages List */}
      <div className="p-4">
        {conversations.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700 text-center py-12">
            <CardContent className="flex flex-col items-center">
              <MessageCircle className="h-16 w-16 text-gray-400 mb-4" />
              <CardTitle className="text-white mb-2" data-testid="text-no-messages">
                No messages yet
              </CardTitle>
              <CardDescription className="text-gray-400 mb-4">
                Start connecting with other event organizers and attendees
              </CardDescription>
              <p className="text-sm text-gray-500">
                Messages will appear here when you interact with other users through events
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation: any) => (
              <Card key={conversation.id} className="bg-slate-800 border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={conversation.user?.profileImageUrl} />
                      <AvatarFallback className="bg-blue-600 text-white">
                        {conversation.user?.firstName?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-white truncate">
                          {conversation.user?.firstName} {conversation.user?.lastName}
                        </h3>
                        <span className="text-xs text-gray-400">
                          {new Date(conversation.lastMessage?.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">
                        {conversation.lastMessage?.content}
                      </p>
                    </div>
                    {!conversation.lastMessage?.isRead && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="messages" />
    </div>
  );
}
