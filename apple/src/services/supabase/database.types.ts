export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      care_events: {
        Row: {
          action: Database['public']['Enums']['care_action'];
          id: string;
          occurred_at: string;
          owner_id: string;
          pet_id: string;
          received_at: string;
          result_revision: number | null;
        };
        Insert: {
          action: Database['public']['Enums']['care_action'];
          id: string;
          occurred_at: string;
          owner_id: string;
          pet_id: string;
          received_at?: string;
          result_revision?: number | null;
        };
        Update: {
          action?: Database['public']['Enums']['care_action'];
          id?: string;
          occurred_at?: string;
          owner_id?: string;
          pet_id?: string;
          received_at?: string;
          result_revision?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'care_events_pet_id_fkey';
            columns: ['pet_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id'];
          },
        ];
      };
      pets: {
        Row: {
          born_at: string;
          cleanliness: number;
          created_at: string;
          died_at: string | null;
          diet: Database['public']['Enums']['pet_diet'];
          energy: number;
          evolution_stage: number;
          favorite_food: string;
          happiness: number;
          hunger: number;
          id: string;
          last_cared_at: string;
          lifecycle_status: Database['public']['Enums']['pet_lifecycle_status'];
          name: string;
          owner_id: string;
          pending_messes_at: string[];
          personality_tags: string[];
          rarity: Database['public']['Enums']['pet_rarity'];
          revision: number;
          skin_id: string;
          sleep_end_minute: number;
          sleep_start_minute: number;
          updated_at: string;
        };
        Insert: {
          born_at?: string;
          cleanliness?: number;
          created_at?: string;
          died_at?: string | null;
          diet?: Database['public']['Enums']['pet_diet'];
          energy?: number;
          evolution_stage?: number;
          favorite_food?: string;
          happiness?: number;
          hunger?: number;
          id?: string;
          last_cared_at?: string;
          lifecycle_status?: Database['public']['Enums']['pet_lifecycle_status'];
          name: string;
          owner_id: string;
          pending_messes_at?: string[];
          personality_tags?: string[];
          rarity: Database['public']['Enums']['pet_rarity'];
          revision?: number;
          skin_id: string;
          sleep_end_minute?: number;
          sleep_start_minute?: number;
          updated_at?: string;
        };
        Update: {
          born_at?: string;
          cleanliness?: number;
          created_at?: string;
          died_at?: string | null;
          diet?: Database['public']['Enums']['pet_diet'];
          energy?: number;
          evolution_stage?: number;
          favorite_food?: string;
          happiness?: number;
          hunger?: number;
          id?: string;
          last_cared_at?: string;
          lifecycle_status?: Database['public']['Enums']['pet_lifecycle_status'];
          name?: string;
          owner_id?: string;
          pending_messes_at?: string[];
          personality_tags?: string[];
          rarity?: Database['public']['Enums']['pet_rarity'];
          revision?: number;
          skin_id?: string;
          sleep_end_minute?: number;
          sleep_start_minute?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      hatch_pet: {
        Args: {
          p_diet?: Database['public']['Enums']['pet_diet'];
          p_name: string;
          p_skin_id: string;
        };
        Returns: {
          born_at: string;
          cleanliness: number;
          created_at: string;
          died_at: string | null;
          diet: Database['public']['Enums']['pet_diet'];
          energy: number;
          evolution_stage: number;
          favorite_food: string;
          happiness: number;
          hunger: number;
          id: string;
          last_cared_at: string;
          lifecycle_status: Database['public']['Enums']['pet_lifecycle_status'];
          name: string;
          owner_id: string;
          pending_messes_at: string[];
          personality_tags: string[];
          rarity: Database['public']['Enums']['pet_rarity'];
          revision: number;
          skin_id: string;
          sleep_end_minute: number;
          sleep_start_minute: number;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'pets';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      care_action:
        'feed' | 'clean' | 'attention' | 'rest' | 'evolve' | 'revive';
      pet_diet: 'omnivore' | 'vegetarian' | 'vegan';
      pet_lifecycle_status: 'alive' | 'dead' | 'reviving';
      pet_rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      care_action: ['feed', 'clean', 'attention', 'rest', 'evolve', 'revive'],
      pet_diet: ['omnivore', 'vegetarian', 'vegan'],
      pet_lifecycle_status: ['alive', 'dead', 'reviving'],
      pet_rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    },
  },
} as const;
