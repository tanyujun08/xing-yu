// Generated from the copied OpenAPI contract; synthetic values only.
export const schemas = {
  "ExternalRefundVerificationRequest": {
    "out_refund_no": "演示内容"
  },
  "OpsRefundHistoryPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "OpsPaymentHistoryPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "RefundHistoryPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "PaymentHistoryPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "FundsSummary": {
    "gross_received_fen": "1",
    "refunded_fen": "1",
    "net_received_fen": "1",
    "payer_total_fen": "1",
    "payer_refund_fen": "1",
    "payer_net_fen": "1",
    "excess_received_fen": "1",
    "currency": "CNY"
  },
  "RefundSummary": {
    "obligation_fen": "1",
    "refunded_fen": "1",
    "pending_fen": "1",
    "open_obligation_count": 0,
    "latest_refund": {
      "payment_mode": "NORMAL",
      "business_amount_fen": "1",
      "channel_amount_fen": "1",
      "obligation_id": "demo-obligation",
      "original_payment_id": "demo-original_payment",
      "excess_component_fen": "1",
      "refund_id": "demo-refund",
      "order_id": "demo-order",
      "purpose": "DEPOSIT",
      "status": "CREATED",
      "amount_fen": "1",
      "payer_refund_fen": "1",
      "deposit_component_fen": "1",
      "rent_component_fen": "1",
      "refunded_at": "2026-10-14T06:00:00Z",
      "last_verified_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "currency": "CNY"
    }
  },
  "SupplementView": {
    "supplement_id": "demo-supplement",
    "order_id": "demo-order",
    "final_review_id": "demo-final_review",
    "amount_fen": "1",
    "currency": "CNY",
    "status": "UNPAID",
    "active_payment": {
      "payment_mode": "NORMAL",
      "business_amount_fen": "1",
      "channel_amount_fen": "1",
      "supplement_id": "demo-supplement",
      "generation": 0,
      "payment_id": "demo-payment",
      "order_id": "demo-order",
      "purpose": "INITIAL",
      "status": "CREATED",
      "amount_fen": "1",
      "payer_total_fen": "1",
      "currency": "CNY",
      "expires_at": "2026-10-14T06:00:00Z",
      "paid_at": "2026-10-14T06:00:00Z",
      "last_verified_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "created_at": "2026-10-14T06:00:00Z"
    },
    "paid_payment": {
      "payment_mode": "NORMAL",
      "business_amount_fen": "1",
      "channel_amount_fen": "1",
      "supplement_id": "demo-supplement",
      "generation": 0,
      "payment_id": "demo-payment",
      "order_id": "demo-order",
      "purpose": "INITIAL",
      "status": "CREATED",
      "amount_fen": "1",
      "payer_total_fen": "1",
      "currency": "CNY",
      "expires_at": "2026-10-14T06:00:00Z",
      "paid_at": "2026-10-14T06:00:00Z",
      "last_verified_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "created_at": "2026-10-14T06:00:00Z"
    },
    "paid_at": "2026-10-14T06:00:00Z",
    "version": "1"
  },
  "ReturnResolutionRequest": {
    "action": "RECHECK",
    "reason": "演示内容"
  },
  "ReturnMissingItem": {
    "slot_key": "演示内容",
    "item_no": 1,
    "evidence_id": "demo-evidence",
    "reason": "演示内容"
  },
  "ReturnEvidenceItemRequest": {
    "material_id": "demo-material",
    "reason": "演示内容"
  },
  "ReturnEvidenceSlotView": {
    "slot": {
      "slot_key": "演示内容",
      "title": "演示资料",
      "kind": "PHOTO",
      "stage": "PRE_RETURN",
      "min_count": 1,
      "max_count": 1,
      "instruction": "演示内容",
      "sort_order": 0,
      "example": {
        "object_key": "演示内容",
        "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "mime_type": "image/jpeg",
        "poster_object_key": "演示内容",
        "url": "演示内容",
        "poster_url": "演示内容"
      }
    },
    "items": [],
    "complete": false,
    "editable": false,
    "blocker": "演示内容"
  },
  "ReturnEvidenceItem": {
    "evidence_id": "demo-evidence",
    "slot_key": "演示内容",
    "item_no": 1,
    "revision_no": 1,
    "binding_version": "1",
    "material_id": "demo-material",
    "kind": "PHOTO",
    "stage": "PRE_RETURN",
    "is_current": false,
    "replaces_evidence_id": "demo-replaces_evidence",
    "source": "TENANT",
    "submitted_by": "演示内容",
    "reason": "演示内容",
    "created_at": "2026-10-14T06:00:00Z",
    "availability": "READY",
    "media": {
      "material_id": "demo-material",
      "role": "COVER",
      "sort_order": 0,
      "url": "演示内容",
      "mime_type": "演示内容",
      "size_bytes": 1,
      "metadata": {
        "schema_version": 1,
        "width": 1,
        "height": 1,
        "duration_ms": 1,
        "video_codec": "演示内容",
        "audio_codec": "演示内容"
      },
      "poster": {
        "material_id": "demo-material",
        "url": "演示内容",
        "width": 1,
        "height": 1
      }
    }
  },
  "ReturnEvidenceTemplate": {
    "template_key": "演示内容",
    "version": "1",
    "title": "演示资料",
    "slots": [
      {
        "slot_key": "演示内容",
        "title": "演示资料",
        "kind": "PHOTO",
        "stage": "PRE_RETURN",
        "min_count": 1,
        "max_count": 1,
        "instruction": "演示内容",
        "sort_order": 0,
        "example": {
          "object_key": "演示内容",
          "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "mime_type": "image/jpeg",
          "poster_object_key": "演示内容",
          "url": "演示内容",
          "poster_url": "演示内容"
        }
      }
    ]
  },
  "ReturnEvidenceSlot": {
    "slot_key": "演示内容",
    "title": "演示资料",
    "kind": "PHOTO",
    "stage": "PRE_RETURN",
    "min_count": 1,
    "max_count": 1,
    "instruction": "演示内容",
    "sort_order": 0,
    "example": {
      "object_key": "演示内容",
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "mime_type": "image/jpeg",
      "poster_object_key": "演示内容",
      "url": "演示内容",
      "poster_url": "演示内容"
    }
  },
  "ReturnEvidenceExample": {
    "object_key": "演示内容",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "mime_type": "image/jpeg",
    "poster_object_key": "演示内容",
    "url": "演示内容",
    "poster_url": "演示内容"
  },
  "ContractConsentRequest": {
    "accepted": true,
    "agreement_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "order_terms_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "CreateIdentityVerificationRequest": {
    "real_name": "演示内容",
    "identity_number": "1"
  },
  "IdentityVerification": {
    "verification_id": "demo-verification",
    "check_kind": "REAL_NAME",
    "status": "NOT_VERIFIED",
    "can_create_verification": false,
    "verified_at": "2026-10-14T06:00:00Z",
    "valid_until": "2026-10-14T06:00:00Z",
    "version": 1,
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z"
  },
  "ID": "演示内容",
  "Fen": "1",
  "Version": "1",
  "Time": "2026-10-14T06:00:00Z",
  "Token": "演示内容",
  "Reason": "演示内容",
  "Tracking": "演示内容",
  "Empty": {},
  "Method": "EXPRESS",
  "Stage": "PREPARING",
  "Physical": "NOT_DELIVERED",
  "ReviewStatus": "NOT_STARTED",
  "PaymentStatus": "CREATED",
  "RefundStatus": "CREATED",
  "Blocker": {
    "code": "演示内容",
    "field": "演示内容",
    "message": "演示内容"
  },
  "Action": {
    "action_code": "CREATE_PREPARATION",
    "allowed": false,
    "reason_code": "演示内容",
    "display_reason": "演示内容",
    "target": "演示内容",
    "required_version": "1"
  },
  "FieldViolation": {
    "field": "演示内容",
    "reason": "演示内容",
    "rule": "演示内容"
  },
  "CommandResult": {
    "state": "ACCEPTED",
    "resource_type": "ORDER",
    "resource_id": "demo-resource",
    "order_id": "demo-order",
    "version": "1",
    "poll_after_seconds": 0,
    "allowed_actions": [],
    "blockers": []
  },
  "LookupView": {
    "state": "NOT_FOUND",
    "result": {
      "state": "ACCEPTED",
      "resource_type": "ORDER",
      "resource_id": "demo-resource",
      "order_id": "demo-order",
      "version": "1",
      "poll_after_seconds": 0,
      "allowed_actions": [],
      "blockers": []
    },
    "error": {
      "code": "EXPORT_RANGE_TOO_LARGE",
      "message": "演示内容",
      "request_id": "demo-request",
      "details": {
        "errors": [
          {
            "field": "演示内容",
            "reason": "演示内容",
            "rule": "演示内容"
          }
        ]
      }
    },
    "retry_same_request": false
  },
  "QuoteRequest": {
    "0": "演",
    "1": "示",
    "2": "内",
    "3": "容"
  },
  "FeeBreakdown": {
    "rent_gross_fen": "1",
    "rent_discount_fen": "1",
    "deposit_list_fen": "1",
    "deposit_waived_fen": "1",
    "deposit_due_fen": "1",
    "initial_due_fen": "1",
    "currency": "CNY"
  },
  "QuoteView": {
    "terms_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "fees": {
      "rent_gross_fen": "1",
      "rent_discount_fen": "1",
      "deposit_list_fen": "1",
      "deposit_waived_fen": "1",
      "deposit_due_fen": "1",
      "initial_due_fen": "1",
      "currency": "CNY"
    },
    "max_payable_fen": "1",
    "required_signer_roles": [
      "TENANT"
    ],
    "blockers": [],
    "requirements": {
      "policy_version_id": "1",
      "allowed_return_methods": [
        "EXPRESS"
      ],
      "outbound_freight_payer": "TENANT",
      "return_freight_payer": "TENANT",
      "freight_included": false,
      "return_instructions": "演示内容",
      "pickup_instructions": "演示内容",
      "media": {
        "photo_bytes_max": "1",
        "video_bytes_max": "1",
        "video_seconds_max": 1,
        "photo_mime_types": [
          "演示内容"
        ],
        "video_mime_types": [
          "演示内容"
        ]
      },
      "return_evidence_template": {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容",
              "url": "演示内容",
              "poster_url": "演示内容"
            }
          }
        ]
      }
    }
  },
  "PreparationRequest": {
    "0": "演",
    "1": "示",
    "2": "内",
    "3": "容"
  },
  "Signer": {
    "role": "TENANT",
    "status": "PENDING",
    "signed_at": "2026-10-14T06:00:00Z",
    "session_id": "demo-session",
    "account_id": "demo-account"
  },
  "ContractView": {
    "contract_id": "demo-contract",
    "order_id": "demo-order",
    "status": "PENDING",
    "template_version_id": "1",
    "document_template": {
      "template_version_id": "1",
      "source_docx_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    "lessor_signature": {
      "name": "演示资料",
      "mode": "DEFAULT_SIGNED",
      "source": "USER_CONFIRMED_LOCAL_DEFAULT",
      "presignature_id": null,
      "material_id": null,
      "signed_at": null
    },
    "tenant_signature": {
      "name": "演示资料",
      "account_id": "demo-account",
      "status": "PENDING",
      "signed_at": "2026-10-14T06:00:00Z"
    },
    "current_attempt": {
      "attempt_id": "demo-attempt",
      "client_signature_id": "demo-client_signature",
      "status": "BUILDING",
      "version": "1",
      "preview_artifact_id": "demo-preview_artifact",
      "preview_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "error_code": "演示内容",
      "allowed_actions": [],
      "expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z"
    },
    "final_artifact": {
      "artifact_id": "demo-artifact",
      "document_material_id": "demo-document_material",
      "document_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "document_url": "演示内容",
      "page_count": 1,
      "pages": [
        {
          "page_no": 1,
          "material_id": "demo-material",
          "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "演示内容"
        }
      ],
      "anchor_snapshot_json": [
        {
          "role": "TENANT_MAIN",
          "page_no": 1,
          "x": 0,
          "y": 0,
          "w": 1,
          "h": 1
        }
      ],
      "renderer_version": "1"
    },
    "quota_state": "NOT_APPLICABLE",
    "quota_valid_until": "2026-10-14T06:00:00Z",
    "expires_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "blockers": [],
    "agreement_text": "演示内容",
    "agreement_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "order_terms_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "PaymentRequest": {
    "supplement_id": "demo-supplement",
    "purpose": "INITIAL"
  },
  "PaymentView": {
    "payment_mode": "NORMAL",
    "business_amount_fen": "1",
    "channel_amount_fen": "1",
    "supplement_id": "demo-supplement",
    "generation": 0,
    "payment_id": "demo-payment",
    "order_id": "demo-order",
    "purpose": "INITIAL",
    "status": "CREATED",
    "amount_fen": "1",
    "payer_total_fen": "1",
    "currency": "CNY",
    "expires_at": "2026-10-14T06:00:00Z",
    "paid_at": "2026-10-14T06:00:00Z",
    "last_verified_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "blockers": [],
    "created_at": "2026-10-14T06:00:00Z"
  },
  "Invocation": {
    "payment_id": "demo-payment",
    "app_id": "demo-app",
    "time_stamp": "1",
    "nonce_str": "演示内容",
    "package": "演示内容",
    "sign_type": "RSA",
    "pay_sign": "演示内容",
    "expires_at": "2026-10-14T06:00:00Z"
  },
  "RefundView": {
    "payment_mode": "NORMAL",
    "business_amount_fen": "1",
    "channel_amount_fen": "1",
    "obligation_id": "demo-obligation",
    "original_payment_id": "demo-original_payment",
    "excess_component_fen": "1",
    "refund_id": "demo-refund",
    "order_id": "demo-order",
    "purpose": "DEPOSIT",
    "status": "CREATED",
    "amount_fen": "1",
    "payer_refund_fen": "1",
    "deposit_component_fen": "1",
    "rent_component_fen": "1",
    "refunded_at": "2026-10-14T06:00:00Z",
    "last_verified_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "blockers": [],
    "currency": "CNY"
  },
  "AssetSummary": {
    "asset_id": "demo-asset",
    "asset_revision_id": "demo-asset_revision",
    "title": "演示资料",
    "cover_material_id": "demo-cover_material",
    "cover_media": {
      "material_id": "demo-material",
      "role": "COVER",
      "sort_order": 0,
      "url": "演示内容",
      "mime_type": "演示内容",
      "size_bytes": 1,
      "metadata": {
        "schema_version": 1,
        "width": 1,
        "height": 1,
        "duration_ms": 1,
        "video_codec": "演示内容",
        "audio_codec": "演示内容"
      },
      "poster": {
        "material_id": "demo-material",
        "url": "演示内容",
        "width": 1,
        "height": 1
      }
    }
  },
  "OrderSummary": {
    "payment_mode": "NORMAL",
    "order_id": "demo-order",
    "order_no": "演示内容",
    "viewer_role": "TENANT",
    "supply_channel": "PERSONAL",
    "stage": "PREPARING",
    "physical_status": "NOT_DELIVERED",
    "review_status": "NOT_STARTED",
    "display_status": "演示内容",
    "has_exception": false,
    "exception_codes": [],
    "asset": {
      "asset_id": "demo-asset",
      "asset_revision_id": "demo-asset_revision",
      "title": "演示资料",
      "cover_material_id": "demo-cover_material",
      "cover_media": {
        "material_id": "demo-material",
        "role": "COVER",
        "sort_order": 0,
        "url": "演示内容",
        "mime_type": "演示内容",
        "size_bytes": 1,
        "metadata": {
          "schema_version": 1,
          "width": 1,
          "height": 1,
          "duration_ms": 1,
          "video_codec": "演示内容",
          "audio_codec": "演示内容"
        },
        "poster": {
          "material_id": "demo-material",
          "url": "演示内容",
          "width": 1,
          "height": 1
        }
      }
    },
    "rental_start_at": "2026-10-14T06:00:00Z",
    "rental_end_at": "2026-10-14T06:00:00Z",
    "placed_at": "2026-10-14T06:00:00Z",
    "created_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "blockers": [],
    "display_status_code": "PREPARING",
    "initial_due_fen": "1",
    "initial_paid_fen": "1",
    "supplement_due_fen": "1",
    "payment_due_at": "2026-10-14T06:00:00Z",
    "initial_payer_total_fen": "1"
  },
  "AddressView": {
    "recipient_name": "演示内容",
    "country_code": "1",
    "phone": "1",
    "region_ids": [
      "演示内容"
    ],
    "region_text": "演示内容",
    "detail": "演示内容",
    "source_id": "demo-source"
  },
  "DeliveryView": {
    "method": "EXPRESS",
    "recipient": {
      "recipient_name": "演示内容",
      "country_code": "1",
      "phone": "1",
      "region_ids": [
        "演示内容"
      ],
      "region_text": "演示内容",
      "detail": "演示内容",
      "source_id": "demo-source"
    },
    "tracking_no": "演示内容",
    "carrier": "演示内容",
    "shipped_at": "2026-10-14T06:00:00Z",
    "delivered_at": "2026-10-14T06:00:00Z"
  },
  "BillView": {
    "payment_mode": "NORMAL",
    "finalized": false,
    "review_id": "demo-review",
    "deposit_received_fen": "1",
    "overtime_fen": "1",
    "loss_fen": "1",
    "deducted_fen": "1",
    "refund_due_fen": "1",
    "supplement_due_fen": "1",
    "deposit_refunded_fen": "1",
    "initial_payment": {
      "payment_mode": "NORMAL",
      "business_amount_fen": "1",
      "channel_amount_fen": "1",
      "supplement_id": "demo-supplement",
      "generation": 0,
      "payment_id": "demo-payment",
      "order_id": "demo-order",
      "purpose": "INITIAL",
      "status": "CREATED",
      "amount_fen": "1",
      "payer_total_fen": "1",
      "currency": "CNY",
      "expires_at": "2026-10-14T06:00:00Z",
      "paid_at": "2026-10-14T06:00:00Z",
      "last_verified_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "created_at": "2026-10-14T06:00:00Z"
    },
    "supplement": {
      "supplement_id": "demo-supplement",
      "order_id": "demo-order",
      "final_review_id": "demo-final_review",
      "amount_fen": "1",
      "currency": "CNY",
      "status": "UNPAID",
      "active_payment": {
        "payment_mode": "NORMAL",
        "business_amount_fen": "1",
        "channel_amount_fen": "1",
        "supplement_id": "demo-supplement",
        "generation": 0,
        "payment_id": "demo-payment",
        "order_id": "demo-order",
        "purpose": "INITIAL",
        "status": "CREATED",
        "amount_fen": "1",
        "payer_total_fen": "1",
        "currency": "CNY",
        "expires_at": "2026-10-14T06:00:00Z",
        "paid_at": "2026-10-14T06:00:00Z",
        "last_verified_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "created_at": "2026-10-14T06:00:00Z"
      },
      "paid_payment": {
        "payment_mode": "NORMAL",
        "business_amount_fen": "1",
        "channel_amount_fen": "1",
        "supplement_id": "demo-supplement",
        "generation": 0,
        "payment_id": "demo-payment",
        "order_id": "demo-order",
        "purpose": "INITIAL",
        "status": "CREATED",
        "amount_fen": "1",
        "payer_total_fen": "1",
        "currency": "CNY",
        "expires_at": "2026-10-14T06:00:00Z",
        "paid_at": "2026-10-14T06:00:00Z",
        "last_verified_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "created_at": "2026-10-14T06:00:00Z"
      },
      "paid_at": "2026-10-14T06:00:00Z",
      "version": "1"
    },
    "refund_summary": {
      "obligation_fen": "1",
      "refunded_fen": "1",
      "pending_fen": "1",
      "open_obligation_count": 0,
      "latest_refund": {
        "payment_mode": "NORMAL",
        "business_amount_fen": "1",
        "channel_amount_fen": "1",
        "obligation_id": "demo-obligation",
        "original_payment_id": "demo-original_payment",
        "excess_component_fen": "1",
        "refund_id": "demo-refund",
        "order_id": "demo-order",
        "purpose": "DEPOSIT",
        "status": "CREATED",
        "amount_fen": "1",
        "payer_refund_fen": "1",
        "deposit_component_fen": "1",
        "rent_component_fen": "1",
        "refunded_at": "2026-10-14T06:00:00Z",
        "last_verified_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "currency": "CNY"
      }
    },
    "funds_summary": {
      "gross_received_fen": "1",
      "refunded_fen": "1",
      "net_received_fen": "1",
      "payer_total_fen": "1",
      "payer_refund_fen": "1",
      "payer_net_fen": "1",
      "excess_received_fen": "1",
      "currency": "CNY"
    },
    "assessment": {
      "review_id": "demo-review",
      "review_no": "1",
      "decision": "APPROVE_FINAL",
      "rejection_reason": "演示内容",
      "missing_items": [],
      "adjustment_reason": "演示内容",
      "overtime_basis": {
        "end_at": "2026-10-14T06:00:00Z",
        "cutoff_at": "2026-10-14T06:00:00Z",
        "cutoff_source": "RECEIVED",
        "pricing_config_version_id": "1",
        "unit_seconds": 1,
        "billable_units": "1",
        "unit_price_fen": "1",
        "grace_seconds": 0,
        "rounding": "CEIL_UNIT"
      },
      "loss_items": [],
      "evidence_ids": [],
      "created_at": "2026-10-14T06:00:00Z",
      "evidence": []
    },
    "currency": "CNY"
  },
  "OrderDetail": {
    "server_time": "2026-10-14T06:00:00Z",
    "coupon_status": "RESERVED",
    "order": {
      "payment_mode": "NORMAL",
      "order_id": "demo-order",
      "order_no": "演示内容",
      "viewer_role": "TENANT",
      "supply_channel": "PERSONAL",
      "stage": "PREPARING",
      "physical_status": "NOT_DELIVERED",
      "review_status": "NOT_STARTED",
      "display_status": "演示内容",
      "has_exception": false,
      "exception_codes": [],
      "asset": {
        "asset_id": "demo-asset",
        "asset_revision_id": "demo-asset_revision",
        "title": "演示资料",
        "cover_material_id": "demo-cover_material",
        "cover_media": {
          "material_id": "demo-material",
          "role": "COVER",
          "sort_order": 0,
          "url": "演示内容",
          "mime_type": "演示内容",
          "size_bytes": 1,
          "metadata": {
            "schema_version": 1,
            "width": 1,
            "height": 1,
            "duration_ms": 1,
            "video_codec": "演示内容",
            "audio_codec": "演示内容"
          },
          "poster": {
            "material_id": "demo-material",
            "url": "演示内容",
            "width": 1,
            "height": 1
          }
        }
      },
      "rental_start_at": "2026-10-14T06:00:00Z",
      "rental_end_at": "2026-10-14T06:00:00Z",
      "placed_at": "2026-10-14T06:00:00Z",
      "created_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "display_status_code": "PREPARING",
      "initial_due_fen": "1",
      "initial_paid_fen": "1",
      "supplement_due_fen": "1",
      "payment_due_at": "2026-10-14T06:00:00Z",
      "initial_payer_total_fen": "1"
    },
    "fees": {
      "rent_gross_fen": "1",
      "rent_discount_fen": "1",
      "deposit_list_fen": "1",
      "deposit_waived_fen": "1",
      "deposit_due_fen": "1",
      "initial_due_fen": "1",
      "currency": "CNY"
    },
    "bill": {
      "payment_mode": "NORMAL",
      "finalized": false,
      "review_id": "demo-review",
      "deposit_received_fen": "1",
      "overtime_fen": "1",
      "loss_fen": "1",
      "deducted_fen": "1",
      "refund_due_fen": "1",
      "supplement_due_fen": "1",
      "deposit_refunded_fen": "1",
      "initial_payment": {
        "payment_mode": "NORMAL",
        "business_amount_fen": "1",
        "channel_amount_fen": "1",
        "supplement_id": "demo-supplement",
        "generation": 0,
        "payment_id": "demo-payment",
        "order_id": "demo-order",
        "purpose": "INITIAL",
        "status": "CREATED",
        "amount_fen": "1",
        "payer_total_fen": "1",
        "currency": "CNY",
        "expires_at": "2026-10-14T06:00:00Z",
        "paid_at": "2026-10-14T06:00:00Z",
        "last_verified_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "created_at": "2026-10-14T06:00:00Z"
      },
      "supplement": {
        "supplement_id": "demo-supplement",
        "order_id": "demo-order",
        "final_review_id": "demo-final_review",
        "amount_fen": "1",
        "currency": "CNY",
        "status": "UNPAID",
        "active_payment": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "supplement_id": "demo-supplement",
          "generation": 0,
          "payment_id": "demo-payment",
          "order_id": "demo-order",
          "purpose": "INITIAL",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_total_fen": "1",
          "currency": "CNY",
          "expires_at": "2026-10-14T06:00:00Z",
          "paid_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "created_at": "2026-10-14T06:00:00Z"
        },
        "paid_payment": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "supplement_id": "demo-supplement",
          "generation": 0,
          "payment_id": "demo-payment",
          "order_id": "demo-order",
          "purpose": "INITIAL",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_total_fen": "1",
          "currency": "CNY",
          "expires_at": "2026-10-14T06:00:00Z",
          "paid_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "created_at": "2026-10-14T06:00:00Z"
        },
        "paid_at": "2026-10-14T06:00:00Z",
        "version": "1"
      },
      "refund_summary": {
        "obligation_fen": "1",
        "refunded_fen": "1",
        "pending_fen": "1",
        "open_obligation_count": 0,
        "latest_refund": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "obligation_id": "demo-obligation",
          "original_payment_id": "demo-original_payment",
          "excess_component_fen": "1",
          "refund_id": "demo-refund",
          "order_id": "demo-order",
          "purpose": "DEPOSIT",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_refund_fen": "1",
          "deposit_component_fen": "1",
          "rent_component_fen": "1",
          "refunded_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "currency": "CNY"
        }
      },
      "funds_summary": {
        "gross_received_fen": "1",
        "refunded_fen": "1",
        "net_received_fen": "1",
        "payer_total_fen": "1",
        "payer_refund_fen": "1",
        "payer_net_fen": "1",
        "excess_received_fen": "1",
        "currency": "CNY"
      },
      "assessment": {
        "review_id": "demo-review",
        "review_no": "1",
        "decision": "APPROVE_FINAL",
        "rejection_reason": "演示内容",
        "missing_items": [],
        "adjustment_reason": "演示内容",
        "overtime_basis": {
          "end_at": "2026-10-14T06:00:00Z",
          "cutoff_at": "2026-10-14T06:00:00Z",
          "cutoff_source": "RECEIVED",
          "pricing_config_version_id": "1",
          "unit_seconds": 1,
          "billable_units": "1",
          "unit_price_fen": "1",
          "grace_seconds": 0,
          "rounding": "CEIL_UNIT"
        },
        "loss_items": [],
        "evidence_ids": [],
        "created_at": "2026-10-14T06:00:00Z",
        "evidence": []
      },
      "currency": "CNY"
    },
    "delivery": {
      "method": "EXPRESS",
      "recipient": {
        "recipient_name": "演示内容",
        "country_code": "1",
        "phone": "1",
        "region_ids": [
          "演示内容"
        ],
        "region_text": "演示内容",
        "detail": "演示内容",
        "source_id": "demo-source"
      },
      "tracking_no": "演示内容",
      "carrier": "演示内容",
      "shipped_at": "2026-10-14T06:00:00Z",
      "delivered_at": "2026-10-14T06:00:00Z"
    },
    "contract_id": "demo-contract",
    "return_id": "demo-return",
    "merchant_id": "demo-merchant",
    "earning_id": "demo-earning",
    "payment_due_at": "2026-10-14T06:00:00Z",
    "hold_expires_at": "2026-10-14T06:00:00Z",
    "completed_at": "2026-10-14T06:00:00Z",
    "closed_at": "2026-10-14T06:00:00Z",
    "close_reason": "PREPARATION_EXPIRED",
    "asset_snapshot": {
      "asset_id": "demo-asset",
      "asset_revision_id": "demo-asset_revision",
      "title": "演示资料",
      "description": "演示内容",
      "condition_description": "演示内容",
      "physical_identifier_display": "演示内容",
      "material_ids": [],
      "accessories": [],
      "media": []
    },
    "requirements": {
      "policy_version_id": "1",
      "allowed_return_methods": [
        "EXPRESS"
      ],
      "outbound_freight_payer": "TENANT",
      "return_freight_payer": "TENANT",
      "freight_included": false,
      "return_instructions": "演示内容",
      "pickup_instructions": "演示内容",
      "media": {
        "photo_bytes_max": "1",
        "video_bytes_max": "1",
        "video_seconds_max": 1,
        "photo_mime_types": [
          "演示内容"
        ],
        "video_mime_types": [
          "演示内容"
        ]
      },
      "return_evidence_template": {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容",
              "url": "演示内容",
              "poster_url": "演示内容"
            }
          }
        ]
      }
    },
    "latest_cabinet_tasks": [],
    "pickup": {
      "cabinet_id": "demo-cabinet",
      "name": "演示资料",
      "address": "演示内容",
      "compartment_id": "demo-compartment",
      "compartment_no": 1,
      "connectivity_status": "ONLINE"
    },
    "checkout": {
      "coupon_id": "demo-coupon"
    }
  },
  "ShippingRequest": {
    "tracking_no": "演示内容",
    "carrier": "演示内容"
  },
  "ShippingCorrection": {
    "tracking_no": "演示内容",
    "carrier": "演示内容",
    "reason": "演示内容"
  },
  "ReturnAddressRequest": {
    "address_id": "demo-address"
  },
  "ReturnDraftRequest": {
    "method": "EXPRESS"
  },
  "ReturnShippingRequest": {
    "tracking_no": "演示内容",
    "carrier": "演示内容",
    "confirmed_address_version": "1"
  },
  "ReturnShippingCorrection": {
    "tracking_no": "演示内容",
    "carrier": "演示内容",
    "reason": "演示内容"
  },
  "EvidenceRef": {
    "material_id": "demo-material",
    "kind": "PHOTO"
  },
  "ReceiptRequest": {
    "received_at": "2026-10-14T06:00:00Z",
    "note": "演示内容"
  },
  "ReceiptCorrection": {
    "received_at": "2026-10-14T06:00:00Z",
    "reason": "演示内容"
  },
  "LossItem": {
    "0": "演",
    "1": "示",
    "2": "内",
    "3": "容"
  },
  "ReturnView": {
    "return_id": "demo-return",
    "order_id": "demo-order",
    "method": "EXPRESS",
    "address_version": "1",
    "address": {
      "recipient_name": "演示内容",
      "country_code": "1",
      "phone": "1",
      "region_ids": [
        "演示内容"
      ],
      "region_text": "演示内容",
      "detail": "演示内容",
      "source_id": "demo-source"
    },
    "confirmed_address_version": "1",
    "tracking_no": "演示内容",
    "carrier": "演示内容",
    "shipped_at": "2026-10-14T06:00:00Z",
    "material_status": "INCOMPLETE",
    "submitted_at": "2026-10-14T06:00:00Z",
    "received_at": "2026-10-14T06:00:00Z",
    "receipt_source": "CABINET",
    "receipt_recorded_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "blockers": [],
    "receipt_note": "演示内容",
    "note": "演示内容",
    "evidence_version": "1",
    "evidence_template": {
      "template_key": "演示内容",
      "version": "1",
      "title": "演示资料",
      "slots": [
        {
          "slot_key": "演示内容",
          "title": "演示资料",
          "kind": "PHOTO",
          "stage": "PRE_RETURN",
          "min_count": 1,
          "max_count": 1,
          "instruction": "演示内容",
          "sort_order": 0,
          "example": {
            "object_key": "演示内容",
            "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "mime_type": "image/jpeg",
            "poster_object_key": "演示内容",
            "url": "演示内容",
            "poster_url": "演示内容"
          }
        }
      ]
    },
    "evidence_slots": [],
    "evidence_history": [],
    "pre_return_complete": false,
    "cabinet_task": {
      "task_id": "demo-task",
      "order_id": "demo-order",
      "purpose": "PICKUP",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "status": "RESERVED",
      "door_status": "OPEN",
      "rfid_result": "MATCH",
      "observed_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "occupancy_result": "TARGET_PRESENT",
      "pre_open_rfid_result": "MATCH",
      "pre_open_observed_at": "2026-10-14T06:00:00Z",
      "verification_requested_at": "2026-10-14T06:00:00Z",
      "cabinet_name": "演示内容",
      "compartment_no": "1"
    },
    "missing_items": []
  },
  "ReviewPreviewRequest": {
    "0": "演",
    "1": "示",
    "2": "内",
    "3": "容"
  },
  "ReviewRequest": {
    "0": "演",
    "1": "示",
    "2": "内",
    "3": "容"
  },
  "ReviewPreview": {
    "basis_version": "1",
    "deposit_fen": "1",
    "overtime_fen": "1",
    "loss_fen": "1",
    "deducted_fen": "1",
    "refund_due_fen": "1",
    "supplement_due_fen": "1",
    "blockers": []
  },
  "ReviewView": {
    "review_id": "demo-review",
    "order_id": "demo-order",
    "review_no": "1",
    "overtime_calculated_fen": "1",
    "overtime_assessed_fen": "1",
    "loss_confirmed_fen": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "allocation": {
      "fee_total_fen": "1",
      "deducted_fen": "1",
      "refund_due_fen": "1",
      "supplement_due_fen": "1"
    },
    "assessment": {
      "review_id": "demo-review",
      "review_no": "1",
      "decision": "APPROVE_FINAL",
      "rejection_reason": "演示内容",
      "missing_items": [],
      "adjustment_reason": "演示内容",
      "overtime_basis": {
        "end_at": "2026-10-14T06:00:00Z",
        "cutoff_at": "2026-10-14T06:00:00Z",
        "cutoff_source": "RECEIVED",
        "pricing_config_version_id": "1",
        "unit_seconds": 1,
        "billable_units": "1",
        "unit_price_fen": "1",
        "grace_seconds": 0,
        "rounding": "CEIL_UNIT"
      },
      "loss_items": [],
      "evidence_ids": [],
      "created_at": "2026-10-14T06:00:00Z",
      "evidence": []
    },
    "decision": "APPROVE_FINAL"
  },
  "CabinetOption": {
    "cabinet_id": "demo-cabinet",
    "name": "演示资料",
    "address": "演示内容",
    "compartments": [],
    "connectivity_status": "ONLINE"
  },
  "CabinetReserve": {
    "purpose": "RETURN",
    "cabinet_id": "demo-cabinet",
    "compartment_id": "demo-compartment"
  },
  "CabinetOpen": {
    "pickup_code": "1"
  },
  "CabinetTask": {
    "task_id": "demo-task",
    "order_id": "demo-order",
    "purpose": "PICKUP",
    "cabinet_id": "demo-cabinet",
    "compartment_id": "demo-compartment",
    "status": "RESERVED",
    "door_status": "OPEN",
    "rfid_result": "MATCH",
    "observed_at": "2026-10-14T06:00:00Z",
    "hold_expires_at": "2026-10-14T06:00:00Z",
    "confirmed_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "blockers": [],
    "occupancy_result": "TARGET_PRESENT",
    "pre_open_rfid_result": "MATCH",
    "pre_open_observed_at": "2026-10-14T06:00:00Z",
    "verification_requested_at": "2026-10-14T06:00:00Z",
    "cabinet_name": "演示内容",
    "compartment_no": "1"
  },
  "PickupCredential": {
    "order_id": "demo-order",
    "credential_id": "demo-credential",
    "pickup_code": "1",
    "expires_at": null
  },
  "EarningView": {
    "earning_id": "demo-earning",
    "order_id": "demo-order",
    "beneficiary_kind": "PERSONAL",
    "rent_fen": "1",
    "overtime_fen": "1",
    "loss_fen": "1",
    "subsidy_fen": "1",
    "beneficiary_fen": "1",
    "platform_fen": "1",
    "posted_at": "2026-10-14T06:00:00Z",
    "currency": "CNY",
    "order_no": "演示内容",
    "asset_title": "演示内容",
    "merchant_id": "demo-merchant",
    "merchant_name": "演示内容"
  },
  "WalletSummary": {
    "booked_income_fen": "1",
    "estimated_income_fen": "1",
    "estimated_order_count": 0,
    "withdrawal_enabled": false,
    "currency": "CNY"
  },
  "OrderPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "PaymentPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "RefundPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "EarningPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false,
    "summary": {
      "count": 0,
      "beneficiary_fen": "1",
      "as_of": "2026-10-14T06:00:00Z"
    }
  },
  "ReviewPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "CabinetTaskPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "CabinetOptions": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false,
    "blockers": []
  },
  "ValidationDetails": {
    "errors": [
      {
        "field": "演示内容",
        "reason": "演示内容",
        "rule": "演示内容"
      }
    ]
  },
  "ConflictDetails": {
    "resource_type": "演示内容",
    "resource_id": "demo-resource"
  },
  "RetryDetails": {
    "retry_after_seconds": 1
  },
  "PositiveFen": "1",
  "OpsPaymentView": {
    "payment_mode": "NORMAL",
    "business_amount_fen": "1",
    "channel_amount_fen": "1",
    "supplement_id": "demo-supplement",
    "generation": 0,
    "payment_id": "demo-payment",
    "order_id": "demo-order",
    "purpose": "INITIAL",
    "status": "CREATED",
    "amount_fen": "1",
    "payer_total_fen": "1",
    "currency": "CNY",
    "expires_at": "2026-10-14T06:00:00Z",
    "paid_at": "2026-10-14T06:00:00Z",
    "last_verified_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "blockers": [],
    "out_trade_no": "演示内容",
    "channel_transaction_id": "demo-channel_transaction",
    "mchid": "演示内容",
    "config_version_id": "1",
    "channel_status": "演示内容",
    "last_error_code": "演示内容",
    "created_at": "2026-10-14T06:00:00Z"
  },
  "OpsRefundView": {
    "payment_mode": "NORMAL",
    "business_amount_fen": "1",
    "channel_amount_fen": "1",
    "obligation_id": "demo-obligation",
    "excess_component_fen": "1",
    "refund_id": "demo-refund",
    "order_id": "demo-order",
    "purpose": "DEPOSIT",
    "status": "CREATED",
    "amount_fen": "1",
    "payer_refund_fen": "1",
    "deposit_component_fen": "1",
    "rent_component_fen": "1",
    "refunded_at": "2026-10-14T06:00:00Z",
    "last_verified_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "blockers": [],
    "currency": "CNY",
    "out_refund_no": "演示内容",
    "channel_refund_id": "demo-channel_refund",
    "mchid": "演示内容",
    "config_version_id": "1",
    "original_payment_id": "demo-original_payment",
    "channel_status": "演示内容",
    "last_error_code": "演示内容"
  },
  "OpsPaymentPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "OpsRefundPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "AssetSnapshotView": {
    "asset_id": "demo-asset",
    "asset_revision_id": "demo-asset_revision",
    "title": "演示资料",
    "description": "演示内容",
    "condition_description": "演示内容",
    "physical_identifier_display": "演示内容",
    "material_ids": [],
    "accessories": [],
    "media": []
  },
  "MediaRequirements": {
    "photo_bytes_max": "1",
    "video_bytes_max": "1",
    "video_seconds_max": 1,
    "photo_mime_types": [
      "演示内容"
    ],
    "video_mime_types": [
      "演示内容"
    ]
  },
  "OrderRequirements": {
    "policy_version_id": "1",
    "allowed_return_methods": [
      "EXPRESS"
    ],
    "outbound_freight_payer": "TENANT",
    "return_freight_payer": "TENANT",
    "freight_included": false,
    "return_instructions": "演示内容",
    "pickup_instructions": "演示内容",
    "media": {
      "photo_bytes_max": "1",
      "video_bytes_max": "1",
      "video_seconds_max": 1,
      "photo_mime_types": [
        "演示内容"
      ],
      "video_mime_types": [
        "演示内容"
      ]
    },
    "return_evidence_template": {
      "template_key": "演示内容",
      "version": "1",
      "title": "演示资料",
      "slots": [
        {
          "slot_key": "演示内容",
          "title": "演示资料",
          "kind": "PHOTO",
          "stage": "PRE_RETURN",
          "min_count": 1,
          "max_count": 1,
          "instruction": "演示内容",
          "sort_order": 0,
          "example": {
            "object_key": "演示内容",
            "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "mime_type": "image/jpeg",
            "poster_object_key": "演示内容",
            "url": "演示内容",
            "poster_url": "演示内容"
          }
        }
      ]
    }
  },
  "OvertimeBasis": {
    "end_at": "2026-10-14T06:00:00Z",
    "cutoff_at": "2026-10-14T06:00:00Z",
    "cutoff_source": "RECEIVED",
    "pricing_config_version_id": "1",
    "unit_seconds": 1,
    "billable_units": "1",
    "unit_price_fen": "1",
    "grace_seconds": 0,
    "rounding": "CEIL_UNIT"
  },
  "AssessmentView": {
    "review_id": "demo-review",
    "review_no": "1",
    "decision": "APPROVE_FINAL",
    "rejection_reason": "演示内容",
    "missing_items": [],
    "adjustment_reason": "演示内容",
    "overtime_basis": {
      "end_at": "2026-10-14T06:00:00Z",
      "cutoff_at": "2026-10-14T06:00:00Z",
      "cutoff_source": "RECEIVED",
      "pricing_config_version_id": "1",
      "unit_seconds": 1,
      "billable_units": "1",
      "unit_price_fen": "1",
      "grace_seconds": 0,
      "rounding": "CEIL_UNIT"
    },
    "loss_items": [],
    "evidence_ids": [],
    "created_at": "2026-10-14T06:00:00Z",
    "evidence": []
  },
  "ReviewAllocation": {
    "fee_total_fen": "1",
    "deducted_fen": "1",
    "refund_due_fen": "1",
    "supplement_due_fen": "1"
  },
  "CabinetScene": "演示内容",
  "CabinetEntry": {
    "cabinet_id": "demo-cabinet",
    "name": "演示资料",
    "address": "演示内容",
    "connectivity_status": "ONLINE",
    "pickup_enabled": false,
    "login_required": true
  },
  "CabinetPickupResolveRequest": {
    "scene": "演示内容",
    "pickup_code": "1"
  },
  "AddressVersion": "1",
  "PositiveAddressVersion": "1",
  "ByteCount": "1",
  "PickupContext": {
    "cabinet_id": "demo-cabinet",
    "name": "演示资料",
    "address": "演示内容",
    "compartment_id": "demo-compartment",
    "compartment_no": 1,
    "connectivity_status": "ONLINE"
  },
  "CheckoutSelection": {
    "coupon_id": "demo-coupon"
  },
  "DeliveryConfirmationRequest": {},
  "Quantity": "1",
  "PublicMaterialMedia": {
    "material_id": "demo-material",
    "role": "COVER",
    "sort_order": 0,
    "url": "演示内容",
    "mime_type": "演示内容",
    "size_bytes": 1,
    "metadata": {
      "schema_version": 1,
      "width": 1,
      "height": 1,
      "duration_ms": 1,
      "video_codec": "演示内容",
      "audio_codec": "演示内容"
    },
    "poster": {
      "material_id": "demo-material",
      "url": "演示内容",
      "width": 1,
      "height": 1
    }
  },
  "PublicMaterialURL": "演示内容",
  "MediaMetadataV1": {
    "schema_version": 1,
    "width": 1,
    "height": 1,
    "duration_ms": 1,
    "video_codec": "演示内容",
    "audio_codec": "演示内容"
  },
  "MaterialPoster": {
    "material_id": "demo-material",
    "url": "演示内容",
    "width": 1,
    "height": 1
  },
  "OrderMediaView": {
    "0": "演",
    "1": "示",
    "2": "内",
    "3": "容"
  },
  "LossItemView": {
    "0": "演",
    "1": "示",
    "2": "内",
    "3": "容"
  },
  "OpsOrderParticipants": {
    "tenant_account_id": "demo-tenant_account",
    "tenant_display_name": "演示内容",
    "lessor_id": "demo-lessor",
    "lessor_account_id": "demo-lessor_account",
    "lessor_display_name": "演示内容",
    "merchant_id": "demo-merchant",
    "merchant_name": "演示内容"
  },
  "OpsOrderSummary": {
    "payment_mode": "NORMAL",
    "order_id": "demo-order",
    "order_no": "演示内容",
    "viewer_role": "TENANT",
    "supply_channel": "PERSONAL",
    "stage": "PREPARING",
    "physical_status": "NOT_DELIVERED",
    "review_status": "NOT_STARTED",
    "display_status": "演示内容",
    "has_exception": false,
    "exception_codes": [],
    "asset": {
      "asset_id": "demo-asset",
      "asset_revision_id": "demo-asset_revision",
      "title": "演示资料",
      "cover_material_id": "demo-cover_material",
      "cover_media": {
        "material_id": "demo-material",
        "role": "COVER",
        "sort_order": 0,
        "url": "演示内容",
        "mime_type": "演示内容",
        "size_bytes": 1,
        "metadata": {
          "schema_version": 1,
          "width": 1,
          "height": 1,
          "duration_ms": 1,
          "video_codec": "演示内容",
          "audio_codec": "演示内容"
        },
        "poster": {
          "material_id": "demo-material",
          "url": "演示内容",
          "width": 1,
          "height": 1
        }
      }
    },
    "rental_start_at": "2026-10-14T06:00:00Z",
    "rental_end_at": "2026-10-14T06:00:00Z",
    "placed_at": "2026-10-14T06:00:00Z",
    "created_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "blockers": [],
    "display_status_code": "PREPARING",
    "initial_due_fen": "1",
    "initial_paid_fen": "1",
    "supplement_due_fen": "1",
    "payment_due_at": "2026-10-14T06:00:00Z",
    "initial_payer_total_fen": "1",
    "participants": {
      "tenant_account_id": "demo-tenant_account",
      "tenant_display_name": "演示内容",
      "lessor_id": "demo-lessor",
      "lessor_account_id": "demo-lessor_account",
      "lessor_display_name": "演示内容",
      "merchant_id": "demo-merchant",
      "merchant_name": "演示内容"
    }
  },
  "OpsOrderPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "OpsOrderDetail": {
    "coupon_status": "RESERVED",
    "server_time": "2026-10-14T06:00:00Z",
    "order": {
      "payment_mode": "NORMAL",
      "order_id": "demo-order",
      "order_no": "演示内容",
      "viewer_role": "TENANT",
      "supply_channel": "PERSONAL",
      "stage": "PREPARING",
      "physical_status": "NOT_DELIVERED",
      "review_status": "NOT_STARTED",
      "display_status": "演示内容",
      "has_exception": false,
      "exception_codes": [],
      "asset": {
        "asset_id": "demo-asset",
        "asset_revision_id": "demo-asset_revision",
        "title": "演示资料",
        "cover_material_id": "demo-cover_material",
        "cover_media": {
          "material_id": "demo-material",
          "role": "COVER",
          "sort_order": 0,
          "url": "演示内容",
          "mime_type": "演示内容",
          "size_bytes": 1,
          "metadata": {
            "schema_version": 1,
            "width": 1,
            "height": 1,
            "duration_ms": 1,
            "video_codec": "演示内容",
            "audio_codec": "演示内容"
          },
          "poster": {
            "material_id": "demo-material",
            "url": "演示内容",
            "width": 1,
            "height": 1
          }
        }
      },
      "rental_start_at": "2026-10-14T06:00:00Z",
      "rental_end_at": "2026-10-14T06:00:00Z",
      "placed_at": "2026-10-14T06:00:00Z",
      "created_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "display_status_code": "PREPARING",
      "initial_due_fen": "1",
      "initial_paid_fen": "1",
      "supplement_due_fen": "1",
      "payment_due_at": "2026-10-14T06:00:00Z",
      "initial_payer_total_fen": "1",
      "participants": {
        "tenant_account_id": "demo-tenant_account",
        "tenant_display_name": "演示内容",
        "lessor_id": "demo-lessor",
        "lessor_account_id": "demo-lessor_account",
        "lessor_display_name": "演示内容",
        "merchant_id": "demo-merchant",
        "merchant_name": "演示内容"
      }
    },
    "fees": {
      "rent_gross_fen": "1",
      "rent_discount_fen": "1",
      "deposit_list_fen": "1",
      "deposit_waived_fen": "1",
      "deposit_due_fen": "1",
      "initial_due_fen": "1",
      "currency": "CNY"
    },
    "bill": {
      "payment_mode": "NORMAL",
      "finalized": false,
      "review_id": "demo-review",
      "deposit_received_fen": "1",
      "overtime_fen": "1",
      "loss_fen": "1",
      "deducted_fen": "1",
      "refund_due_fen": "1",
      "supplement_due_fen": "1",
      "deposit_refunded_fen": "1",
      "initial_payment": {
        "payment_mode": "NORMAL",
        "business_amount_fen": "1",
        "channel_amount_fen": "1",
        "supplement_id": "demo-supplement",
        "generation": 0,
        "payment_id": "demo-payment",
        "order_id": "demo-order",
        "purpose": "INITIAL",
        "status": "CREATED",
        "amount_fen": "1",
        "payer_total_fen": "1",
        "currency": "CNY",
        "expires_at": "2026-10-14T06:00:00Z",
        "paid_at": "2026-10-14T06:00:00Z",
        "last_verified_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "created_at": "2026-10-14T06:00:00Z"
      },
      "supplement": {
        "supplement_id": "demo-supplement",
        "order_id": "demo-order",
        "final_review_id": "demo-final_review",
        "amount_fen": "1",
        "currency": "CNY",
        "status": "UNPAID",
        "active_payment": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "supplement_id": "demo-supplement",
          "generation": 0,
          "payment_id": "demo-payment",
          "order_id": "demo-order",
          "purpose": "INITIAL",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_total_fen": "1",
          "currency": "CNY",
          "expires_at": "2026-10-14T06:00:00Z",
          "paid_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "created_at": "2026-10-14T06:00:00Z"
        },
        "paid_payment": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "supplement_id": "demo-supplement",
          "generation": 0,
          "payment_id": "demo-payment",
          "order_id": "demo-order",
          "purpose": "INITIAL",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_total_fen": "1",
          "currency": "CNY",
          "expires_at": "2026-10-14T06:00:00Z",
          "paid_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "created_at": "2026-10-14T06:00:00Z"
        },
        "paid_at": "2026-10-14T06:00:00Z",
        "version": "1"
      },
      "refund_summary": {
        "obligation_fen": "1",
        "refunded_fen": "1",
        "pending_fen": "1",
        "open_obligation_count": 0,
        "latest_refund": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "obligation_id": "demo-obligation",
          "original_payment_id": "demo-original_payment",
          "excess_component_fen": "1",
          "refund_id": "demo-refund",
          "order_id": "demo-order",
          "purpose": "DEPOSIT",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_refund_fen": "1",
          "deposit_component_fen": "1",
          "rent_component_fen": "1",
          "refunded_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "currency": "CNY"
        }
      },
      "funds_summary": {
        "gross_received_fen": "1",
        "refunded_fen": "1",
        "net_received_fen": "1",
        "payer_total_fen": "1",
        "payer_refund_fen": "1",
        "payer_net_fen": "1",
        "excess_received_fen": "1",
        "currency": "CNY"
      },
      "assessment": {
        "review_id": "demo-review",
        "review_no": "1",
        "decision": "APPROVE_FINAL",
        "rejection_reason": "演示内容",
        "missing_items": [],
        "adjustment_reason": "演示内容",
        "overtime_basis": {
          "end_at": "2026-10-14T06:00:00Z",
          "cutoff_at": "2026-10-14T06:00:00Z",
          "cutoff_source": "RECEIVED",
          "pricing_config_version_id": "1",
          "unit_seconds": 1,
          "billable_units": "1",
          "unit_price_fen": "1",
          "grace_seconds": 0,
          "rounding": "CEIL_UNIT"
        },
        "loss_items": [],
        "evidence_ids": [],
        "created_at": "2026-10-14T06:00:00Z",
        "evidence": []
      },
      "currency": "CNY"
    },
    "delivery": {
      "method": "EXPRESS",
      "recipient": {
        "recipient_name": "演示内容",
        "country_code": "1",
        "phone": "1",
        "region_ids": [
          "演示内容"
        ],
        "region_text": "演示内容",
        "detail": "演示内容",
        "source_id": "demo-source"
      },
      "tracking_no": "演示内容",
      "carrier": "演示内容",
      "shipped_at": "2026-10-14T06:00:00Z",
      "delivered_at": "2026-10-14T06:00:00Z"
    },
    "contract_id": "demo-contract",
    "return_id": "demo-return",
    "merchant_id": "demo-merchant",
    "earning_id": "demo-earning",
    "payment_due_at": "2026-10-14T06:00:00Z",
    "hold_expires_at": "2026-10-14T06:00:00Z",
    "completed_at": "2026-10-14T06:00:00Z",
    "closed_at": "2026-10-14T06:00:00Z",
    "asset_snapshot": {
      "asset_id": "demo-asset",
      "asset_revision_id": "demo-asset_revision",
      "title": "演示资料",
      "description": "演示内容",
      "condition_description": "演示内容",
      "physical_identifier_display": "演示内容",
      "material_ids": [],
      "accessories": [],
      "media": []
    },
    "requirements": {
      "policy_version_id": "1",
      "allowed_return_methods": [
        "EXPRESS"
      ],
      "outbound_freight_payer": "TENANT",
      "return_freight_payer": "TENANT",
      "freight_included": false,
      "return_instructions": "演示内容",
      "pickup_instructions": "演示内容",
      "media": {
        "photo_bytes_max": "1",
        "video_bytes_max": "1",
        "video_seconds_max": 1,
        "photo_mime_types": [
          "演示内容"
        ],
        "video_mime_types": [
          "演示内容"
        ]
      },
      "return_evidence_template": {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容",
              "url": "演示内容",
              "poster_url": "演示内容"
            }
          }
        ]
      }
    },
    "latest_cabinet_tasks": [],
    "pickup": {
      "cabinet_id": "demo-cabinet",
      "name": "演示资料",
      "address": "演示内容",
      "compartment_id": "demo-compartment",
      "compartment_no": 1,
      "connectivity_status": "ONLINE"
    },
    "checkout": {
      "coupon_id": "demo-coupon"
    }
  },
  "OpsEarningView": {
    "earning_id": "demo-earning",
    "order_id": "demo-order",
    "beneficiary_kind": "PERSONAL",
    "rent_fen": "1",
    "overtime_fen": "1",
    "loss_fen": "1",
    "subsidy_fen": "1",
    "beneficiary_fen": "1",
    "platform_fen": "1",
    "posted_at": "2026-10-14T06:00:00Z",
    "currency": "CNY",
    "order_no": "演示内容",
    "asset_title": "演示内容",
    "merchant_id": "demo-merchant",
    "merchant_name": "演示内容",
    "account_id": "demo-account",
    "beneficiary_display_name": "演示内容"
  },
  "OpsEarningPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false,
    "summary": {
      "count": 0,
      "beneficiary_fen": "1",
      "as_of": "2026-10-14T06:00:00Z"
    }
  },
  "ReceiptHistoryItem": {
    "old_received_at": "2026-10-14T06:00:00Z",
    "new_received_at": "2026-10-14T06:00:00Z",
    "reason": "演示内容",
    "actor_account_id": "demo-actor_account",
    "recorded_at": "2026-10-14T06:00:00Z"
  },
  "OpsReturnView": {
    "return_id": "demo-return",
    "order_id": "demo-order",
    "method": "EXPRESS",
    "address_version": "1",
    "address": {
      "recipient_name": "演示内容",
      "country_code": "1",
      "phone": "1",
      "region_ids": [
        "演示内容"
      ],
      "region_text": "演示内容",
      "detail": "演示内容",
      "source_id": "demo-source"
    },
    "confirmed_address_version": "1",
    "tracking_no": "演示内容",
    "carrier": "演示内容",
    "shipped_at": "2026-10-14T06:00:00Z",
    "material_status": "INCOMPLETE",
    "submitted_at": "2026-10-14T06:00:00Z",
    "received_at": "2026-10-14T06:00:00Z",
    "receipt_source": "CABINET",
    "receipt_recorded_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "blockers": [],
    "receipt_note": "演示内容",
    "note": "演示内容",
    "receipt_actor_id": "demo-receipt_actor",
    "receipt_actor_display_name": "演示内容",
    "receipt_history": [],
    "evidence_version": "1",
    "evidence_template": {
      "template_key": "演示内容",
      "version": "1",
      "title": "演示资料",
      "slots": [
        {
          "slot_key": "演示内容",
          "title": "演示资料",
          "kind": "PHOTO",
          "stage": "PRE_RETURN",
          "min_count": 1,
          "max_count": 1,
          "instruction": "演示内容",
          "sort_order": 0,
          "example": {
            "object_key": "演示内容",
            "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "mime_type": "image/jpeg",
            "poster_object_key": "演示内容",
            "url": "演示内容",
            "poster_url": "演示内容"
          }
        }
      ]
    },
    "evidence_slots": [],
    "evidence_history": [],
    "pre_return_complete": false,
    "cabinet_task": {
      "task_id": "demo-task",
      "order_id": "demo-order",
      "purpose": "PICKUP",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "status": "RESERVED",
      "door_status": "OPEN",
      "rfid_result": "MATCH",
      "observed_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "occupancy_result": "TARGET_PRESENT",
      "pre_open_rfid_result": "MATCH",
      "pre_open_observed_at": "2026-10-14T06:00:00Z",
      "verification_requested_at": "2026-10-14T06:00:00Z",
      "cabinet_name": "演示内容",
      "compartment_no": "1"
    },
    "missing_items": []
  },
  "OpsReviewView": {
    "review_id": "demo-review",
    "order_id": "demo-order",
    "review_no": "1",
    "overtime_calculated_fen": "1",
    "overtime_assessed_fen": "1",
    "loss_confirmed_fen": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "allocation": {
      "fee_total_fen": "1",
      "deducted_fen": "1",
      "refund_due_fen": "1",
      "supplement_due_fen": "1"
    },
    "assessment": {
      "review_id": "demo-review",
      "review_no": "1",
      "decision": "APPROVE_FINAL",
      "rejection_reason": "演示内容",
      "missing_items": [],
      "adjustment_reason": "演示内容",
      "overtime_basis": {
        "end_at": "2026-10-14T06:00:00Z",
        "cutoff_at": "2026-10-14T06:00:00Z",
        "cutoff_source": "RECEIVED",
        "pricing_config_version_id": "1",
        "unit_seconds": 1,
        "billable_units": "1",
        "unit_price_fen": "1",
        "grace_seconds": 0,
        "rounding": "CEIL_UNIT"
      },
      "loss_items": [],
      "evidence_ids": [],
      "created_at": "2026-10-14T06:00:00Z",
      "evidence": []
    },
    "decision": "APPROVE_FINAL",
    "actor_account_id": "demo-actor_account",
    "actor_display_name": "演示内容"
  },
  "OpsReviewPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false
  },
  "MiniLookupRequest": {
    "operation_id": "B02",
    "target_id": null,
    "idempotency_key": "演示内容"
  },
  "RentalOrderPolicy": {
    "schema_version": 2,
    "return_instructions": "演示内容",
    "pickup_instructions": "演示内容",
    "grace_seconds": 0,
    "personal_rent_basis_points": 0,
    "loss_beneficiary_basis_points": 0,
    "evidence_templates": [
      {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容"
            }
          }
        ]
      }
    ],
    "template_bindings": [
      {
        "supply_channel": "PERSONAL",
        "fulfillment": "EXPRESS",
        "category_id": "demo-category",
        "template_key": "演示内容"
      }
    ]
  },
  "OwnGrowthTaskClaim": {
    "task": {
      "benefit_code": "演示内容",
      "task_code": "REGISTER",
      "period": "LIFETIME",
      "cycle_key": "演示内容",
      "limit": "1",
      "progress_count": "1",
      "claimed_count": "1",
      "claimable_count": "1",
      "state": "IN_PROGRESS",
      "rewards": []
    },
    "grants": [],
    "replayed": false
  },
  "OwnGrowthTaskList": {
    "enabled": false,
    "disabled_reason": "",
    "rule_version_id": "1",
    "items": [],
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "OwnGrowthTask": {
    "benefit_code": "演示内容",
    "task_code": "REGISTER",
    "period": "LIFETIME",
    "cycle_key": "演示内容",
    "limit": "1",
    "progress_count": "1",
    "claimed_count": "1",
    "claimable_count": "1",
    "state": "IN_PROGRESS",
    "rewards": []
  },
  "BenefitReward": {
    "kind": "PINK",
    "units": "1",
    "quantity": 1,
    "coupon_type": "DEPOSIT_WAIVER",
    "valid_days": 1
  },
  "ClientResourceManifest": {
    "schema_version": 1,
    "client": "MINIPROGRAM",
    "channel": "RELEASE",
    "client_version": "1.0.0.16",
    "config_version_id": "1",
    "config_version_no": 1,
    "effective_epoch": 1,
    "config_content_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "published_at": "2026-10-14T06:00:00Z",
    "manifest_id": "demo-manifest",
    "entries": [
      {
        "resource_key": "演示内容",
        "locale": "演示内容",
        "theme": "LIGHT",
        "material_id": "demo-material",
        "object_version_id": "1",
        "content_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "mime_type": "image/jpeg",
        "size_bytes": 1,
        "url": "演示内容"
      }
    ]
  },
  "ClientResourceManifestEntry": {
    "resource_key": "演示内容",
    "locale": "演示内容",
    "theme": "LIGHT",
    "material_id": "demo-material",
    "object_version_id": "1",
    "content_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "mime_type": "image/jpeg",
    "size_bytes": 1,
    "url": "演示内容"
  },
  "OpsPlatformAssetTerms": {
    "product_id": "demo-product",
    "display_name": "演示资料",
    "condition": "演示内容",
    "defect_description": "演示内容",
    "accessories_text": "演示内容",
    "description": "演示内容",
    "rental_unit": "HOUR",
    "unit_price_fen": "1",
    "deposit_fen": "1",
    "minimum_units": "1",
    "reference_value_fen": "1",
    "available_from": "2026-10-14T06:00:00Z",
    "available_until": "2026-10-14T06:00:00Z",
    "timezone": "Asia/Shanghai",
    "publication_location": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "detail_address": "演示内容",
      "recipient_name": "演示内容",
      "phone_country_code": "+86",
      "phone": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    },
    "media": [
      {
        "material_id": "demo-material",
        "role": "COVER",
        "sort_order": 0
      }
    ],
    "delivery_options": [],
    "rule_version_id": "1",
    "eligibility_rule_version_id": "1"
  },
  "OpsPlatformAssetBatchInput": {
    "0": "演",
    "1": "示",
    "2": "内",
    "3": "容"
  },
  "OpsPlatformAssetRevisionInput": {
    "product_id": "demo-product",
    "display_name": "演示资料",
    "condition": "演示内容",
    "defect_description": "演示内容",
    "accessories_text": "演示内容",
    "description": "演示内容",
    "rental_unit": "HOUR",
    "unit_price_fen": "1",
    "deposit_fen": "1",
    "minimum_units": "1",
    "reference_value_fen": "1",
    "available_from": "2026-10-14T06:00:00Z",
    "available_until": "2026-10-14T06:00:00Z",
    "timezone": "Asia/Shanghai",
    "publication_location": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "detail_address": "演示内容",
      "recipient_name": "演示内容",
      "phone_country_code": "+86",
      "phone": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    },
    "media": [
      {
        "material_id": "demo-material",
        "role": "COVER",
        "sort_order": 0
      }
    ],
    "delivery_options": [],
    "rule_version_id": "1",
    "eligibility_rule_version_id": "1",
    "reason": "演示内容"
  },
  "OpsPlatformAssetCreated": {
    "revision_id": "demo-revision",
    "asset_id": "demo-asset",
    "state": {
      "schema_version": 1,
      "current_revision_id": "demo-current_revision",
      "latest_revision_id": "demo-latest_revision",
      "publish_status": "OFFLINE",
      "availability_status": "AVAILABLE",
      "version": "1"
    },
    "request_index": 0,
    "asset_no": "演示内容"
  },
  "OpsPlatformAssetReceipt": {
    "assets": [
      {
        "revision_id": "demo-revision",
        "asset_id": "demo-asset",
        "state": {
          "schema_version": 1,
          "current_revision_id": "demo-current_revision",
          "latest_revision_id": "demo-latest_revision",
          "publish_status": "OFFLINE",
          "availability_status": "AVAILABLE",
          "version": "1"
        },
        "request_index": 0,
        "asset_no": "演示内容"
      }
    ]
  },
  "OpsPlatformAssetRevisionReceipt": {
    "assets": [
      {
        "revision_id": "demo-revision",
        "asset_id": "demo-asset",
        "state": {
          "schema_version": 1,
          "current_revision_id": "demo-current_revision",
          "latest_revision_id": "demo-latest_revision",
          "publish_status": "OFFLINE",
          "availability_status": "AVAILABLE",
          "version": "1"
        },
        "request_index": 0,
        "asset_no": "演示内容"
      }
    ]
  },
  "OpsPlatformAssetEditDetails": {
    "asset_id": "demo-asset",
    "revision_id": "demo-revision",
    "asset_version": "1",
    "purpose": "PLATFORM_ASSET_EDIT",
    "viewed_at": "2026-10-14T06:00:00Z",
    "expires_at": "2026-10-14T06:00:00Z",
    "publication_location": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容",
      "detail_address": "演示内容",
      "recipient_name": "演示内容",
      "phone_country_code": "1",
      "phone": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    },
    "delivery_locations": []
  },
  "BusinessConflictDetails": {
    "detail_type": "BUSINESS_CONFLICT",
    "resource_type": "演示内容",
    "resource_id": "demo-resource",
    "reason_code": "演示内容",
    "request_index": 0
  },
  "LoyaltyConfigConflict": {
    "field": "演示内容",
    "coupon_type": "DEPOSIT_WAIVER",
    "source_kind": "LOTTERY",
    "source_config_key": "benefits.lottery",
    "source_config_version_id": "1"
  },
  "OpsAssetPrivateCoordinates": {
    "latitude": "1",
    "longitude": "1",
    "coordinate_system": "GCJ02",
    "source": "MAP_PICK"
  },
  "OpsAssetPrivateAddress": {
    "dataset_id": "demo-dataset",
    "province_id": "demo-province",
    "city_id": "demo-city",
    "district_id": "demo-district",
    "province_name": "演示内容",
    "city_name": "演示内容",
    "district_name": "演示内容",
    "detail_address": "演示内容",
    "recipient_name": "演示内容",
    "phone_country_code": "1",
    "phone": "1",
    "location": {
      "latitude": "1",
      "longitude": "1",
      "coordinate_system": "GCJ02",
      "source": "MAP_PICK"
    }
  },
  "OpsAssetPrivateDelivery": {
    "option_id": "demo-option",
    "method": "MEET",
    "address": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容",
      "detail_address": "演示内容",
      "recipient_name": "演示内容",
      "phone_country_code": "1",
      "phone": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    }
  },
  "OpsAssetPrivateDetails": {
    "asset_id": "demo-asset",
    "revision_id": "demo-revision",
    "asset_version": "1",
    "purpose": "ASSET_REVIEW",
    "viewed_at": "2026-10-14T06:00:00Z",
    "expires_at": "2026-10-14T06:00:00Z",
    "publication_location": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容",
      "detail_address": "演示内容",
      "recipient_name": "演示内容",
      "phone_country_code": "1",
      "phone": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    },
    "publication_position": {
      "latitude": "1",
      "longitude": "1",
      "coordinate_system": "GCJ02",
      "source": "WECHAT_CLIENT"
    },
    "delivery_locations": [
      {
        "option_id": "demo-option",
        "method": "MEET",
        "address": {
          "dataset_id": "demo-dataset",
          "province_id": "demo-province",
          "city_id": "demo-city",
          "district_id": "demo-district",
          "province_name": "演示内容",
          "city_name": "演示内容",
          "district_name": "演示内容",
          "detail_address": "演示内容",
          "recipient_name": "演示内容",
          "phone_country_code": "1",
          "phone": "1",
          "location": {
            "latitude": "1",
            "longitude": "1",
            "coordinate_system": "GCJ02",
            "source": "MAP_PICK"
          }
        }
      }
    ]
  },
  "OpsRentalAsset": {
    "asset_id": "demo-asset",
    "asset_no": "演示内容",
    "product_id": "demo-product",
    "product_name": "演示内容",
    "lessor_id": "demo-lessor",
    "lessor_name": "演示内容",
    "supply_type": "PERSONAL",
    "identifier_type": "IMEI",
    "identifier_scope": "演示内容",
    "normalized_identifier": "演示内容",
    "rfid_code": "演示内容",
    "current_revision_id": "demo-current_revision",
    "latest_revision_id": "demo-latest_revision",
    "display_name": "演示资料",
    "latest_review_status": "PENDING",
    "publish_status": "OFFLINE",
    "availability_status": "AVAILABLE",
    "first_listed_at": "2026-10-14T06:00:00Z",
    "last_listed_at": "2026-10-14T06:00:00Z",
    "unlisted_at": "2026-10-14T06:00:00Z",
    "unlisted_reason": "演示内容",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": "1"
  },
  "OpsAssetRevisionSummary": {
    "revision_id": "demo-revision",
    "asset_id": "demo-asset",
    "revision_no": "1",
    "product_id": "demo-product",
    "display_name": "演示资料",
    "rental_unit": "HOUR",
    "unit_price_fen": "1",
    "deposit_fen": "1",
    "minimum_units": "1",
    "reference_value_fen": "1",
    "currency": "CNY",
    "available_from": "2026-10-14T06:00:00Z",
    "available_until": "2026-10-14T06:00:00Z",
    "timezone": "Asia/Shanghai",
    "rule_version_id": "1",
    "eligibility_rule_version_id": "1",
    "identity_check_id": "demo-identity_check",
    "submitted_by": "演示内容",
    "submitted_at": "2026-10-14T06:00:00Z",
    "review_status": "PENDING",
    "reviewed_by": "演示内容",
    "reviewed_at": "2026-10-14T06:00:00Z",
    "review_reason": "演示内容"
  },
  "OpsAssetRegion": {
    "dataset_id": "demo-dataset",
    "province_id": "demo-province",
    "city_id": "demo-city",
    "district_id": "demo-district",
    "province_name": "演示内容",
    "city_name": "演示内容",
    "district_name": "演示内容"
  },
  "OpsAssetDelivery": {
    "option_id": "demo-option",
    "method": "MEET",
    "outbound_fee_payer": "TENANT",
    "return_fee_payer": "TENANT",
    "source_address_id": "demo-source_address",
    "dataset_id": null,
    "province_id": null,
    "city_id": null,
    "district_id": null,
    "instruction": "演示内容",
    "meeting_time_text": "演示内容"
  },
  "OpsAssetProductSnapshot": {
    "schema_version": 1,
    "product_id": "demo-product",
    "product_no": "演示内容",
    "brand_id": "demo-brand",
    "brand_name": "演示内容",
    "category_id": "demo-category",
    "category_name": "演示内容",
    "model_name": "演示内容",
    "product_name": "演示内容",
    "tags": [],
    "cover_material_id": "demo-cover_material"
  },
  "OpsAssetPriceSnapshot": {
    "schema_version": 1,
    "config_version_id": "1",
    "min_unit_price_fen": "1",
    "max_unit_price_fen": "1",
    "recommended_unit_price_fen": "1",
    "rental_mode": "HOUR",
    "captured_at": "2026-10-14T06:00:00Z"
  },
  "OpsAssetRevision": {
    "revision_id": "demo-revision",
    "asset_id": "demo-asset",
    "revision_no": "1",
    "product_id": "demo-product",
    "display_name": "演示资料",
    "rental_unit": "HOUR",
    "unit_price_fen": "1",
    "deposit_fen": "1",
    "minimum_units": "1",
    "reference_value_fen": "1",
    "currency": "CNY",
    "available_from": "2026-10-14T06:00:00Z",
    "available_until": "2026-10-14T06:00:00Z",
    "timezone": "Asia/Shanghai",
    "rule_version_id": "1",
    "eligibility_rule_version_id": "1",
    "identity_check_id": "demo-identity_check",
    "submitted_by": "演示内容",
    "submitted_at": "2026-10-14T06:00:00Z",
    "review_status": "PENDING",
    "reviewed_by": "演示内容",
    "reviewed_at": "2026-10-14T06:00:00Z",
    "review_reason": "演示内容",
    "condition": "演示内容",
    "defect_description": "演示内容",
    "accessories_text": "演示内容",
    "description": "演示内容",
    "product_snapshot": {
      "schema_version": 1,
      "product_id": "demo-product",
      "product_no": "演示内容",
      "brand_id": "demo-brand",
      "brand_name": "演示内容",
      "category_id": "demo-category",
      "category_name": "演示内容",
      "model_name": "演示内容",
      "product_name": "演示内容",
      "tags": [],
      "cover_material_id": "demo-cover_material"
    },
    "pricing_guidance_snapshot": {
      "schema_version": 1,
      "config_version_id": "1",
      "min_unit_price_fen": "1",
      "max_unit_price_fen": "1",
      "recommended_unit_price_fen": "1",
      "rental_mode": "HOUR",
      "captured_at": "2026-10-14T06:00:00Z"
    },
    "publication_region": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容"
    },
    "media": [],
    "delivery_options": []
  },
  "OpsAssetPlacement": {
    "placement_id": "demo-placement",
    "location_kind": "STORE",
    "store_id": "demo-store",
    "cabinet_id": "demo-cabinet",
    "compartment_id": "demo-compartment",
    "confirmed_at": "2026-10-14T06:00:00Z",
    "evidence_set_id": "demo-evidence_set",
    "version": "1"
  },
  "OpsAssetAction": {
    "code": "APPROVE",
    "enabled": false,
    "blocked_reasons": []
  },
  "OpsAssetDossier": {
    "asset": {
      "asset_id": "demo-asset",
      "asset_no": "演示内容",
      "product_id": "demo-product",
      "product_name": "演示内容",
      "lessor_id": "demo-lessor",
      "lessor_name": "演示内容",
      "supply_type": "PERSONAL",
      "identifier_type": "IMEI",
      "identifier_scope": "演示内容",
      "normalized_identifier": "演示内容",
      "rfid_code": "演示内容",
      "current_revision_id": "demo-current_revision",
      "latest_revision_id": "demo-latest_revision",
      "display_name": "演示资料",
      "latest_review_status": "PENDING",
      "publish_status": "OFFLINE",
      "availability_status": "AVAILABLE",
      "first_listed_at": "2026-10-14T06:00:00Z",
      "last_listed_at": "2026-10-14T06:00:00Z",
      "unlisted_at": "2026-10-14T06:00:00Z",
      "unlisted_reason": "演示内容",
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z",
      "version": "1"
    },
    "current_revision": {
      "revision_id": "demo-revision",
      "asset_id": "demo-asset",
      "revision_no": "1",
      "product_id": "demo-product",
      "display_name": "演示资料",
      "rental_unit": "HOUR",
      "unit_price_fen": "1",
      "deposit_fen": "1",
      "minimum_units": "1",
      "reference_value_fen": "1",
      "currency": "CNY",
      "available_from": "2026-10-14T06:00:00Z",
      "available_until": "2026-10-14T06:00:00Z",
      "timezone": "Asia/Shanghai",
      "rule_version_id": "1",
      "eligibility_rule_version_id": "1",
      "identity_check_id": "demo-identity_check",
      "submitted_by": "演示内容",
      "submitted_at": "2026-10-14T06:00:00Z",
      "review_status": "PENDING",
      "reviewed_by": "演示内容",
      "reviewed_at": "2026-10-14T06:00:00Z",
      "review_reason": "演示内容",
      "condition": "演示内容",
      "defect_description": "演示内容",
      "accessories_text": "演示内容",
      "description": "演示内容",
      "product_snapshot": {
        "schema_version": 1,
        "product_id": "demo-product",
        "product_no": "演示内容",
        "brand_id": "demo-brand",
        "brand_name": "演示内容",
        "category_id": "demo-category",
        "category_name": "演示内容",
        "model_name": "演示内容",
        "product_name": "演示内容",
        "tags": [],
        "cover_material_id": "demo-cover_material"
      },
      "pricing_guidance_snapshot": {
        "schema_version": 1,
        "config_version_id": "1",
        "min_unit_price_fen": "1",
        "max_unit_price_fen": "1",
        "recommended_unit_price_fen": "1",
        "rental_mode": "HOUR",
        "captured_at": "2026-10-14T06:00:00Z"
      },
      "publication_region": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "province_name": "演示内容",
        "city_name": "演示内容",
        "district_name": "演示内容"
      },
      "media": [],
      "delivery_options": []
    },
    "latest_revision": {
      "revision_id": "demo-revision",
      "asset_id": "demo-asset",
      "revision_no": "1",
      "product_id": "demo-product",
      "display_name": "演示资料",
      "rental_unit": "HOUR",
      "unit_price_fen": "1",
      "deposit_fen": "1",
      "minimum_units": "1",
      "reference_value_fen": "1",
      "currency": "CNY",
      "available_from": "2026-10-14T06:00:00Z",
      "available_until": "2026-10-14T06:00:00Z",
      "timezone": "Asia/Shanghai",
      "rule_version_id": "1",
      "eligibility_rule_version_id": "1",
      "identity_check_id": "demo-identity_check",
      "submitted_by": "演示内容",
      "submitted_at": "2026-10-14T06:00:00Z",
      "review_status": "PENDING",
      "reviewed_by": "演示内容",
      "reviewed_at": "2026-10-14T06:00:00Z",
      "review_reason": "演示内容",
      "condition": "演示内容",
      "defect_description": "演示内容",
      "accessories_text": "演示内容",
      "description": "演示内容",
      "product_snapshot": {
        "schema_version": 1,
        "product_id": "demo-product",
        "product_no": "演示内容",
        "brand_id": "demo-brand",
        "brand_name": "演示内容",
        "category_id": "demo-category",
        "category_name": "演示内容",
        "model_name": "演示内容",
        "product_name": "演示内容",
        "tags": [],
        "cover_material_id": "demo-cover_material"
      },
      "pricing_guidance_snapshot": {
        "schema_version": 1,
        "config_version_id": "1",
        "min_unit_price_fen": "1",
        "max_unit_price_fen": "1",
        "recommended_unit_price_fen": "1",
        "rental_mode": "HOUR",
        "captured_at": "2026-10-14T06:00:00Z"
      },
      "publication_region": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "province_name": "演示内容",
        "city_name": "演示内容",
        "district_name": "演示内容"
      },
      "media": [],
      "delivery_options": []
    },
    "placement": {
      "placement_id": "demo-placement",
      "location_kind": "STORE",
      "store_id": "demo-store",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "confirmed_at": "2026-10-14T06:00:00Z",
      "evidence_set_id": "demo-evidence_set",
      "version": "1"
    },
    "publication_blockers": [],
    "allowed_actions": [],
    "private_access": "AVAILABLE"
  },
  "OpsAssetState": {
    "schema_version": 1,
    "current_revision_id": "demo-current_revision",
    "latest_revision_id": "demo-latest_revision",
    "publish_status": "OFFLINE",
    "availability_status": "AVAILABLE",
    "version": "1"
  },
  "OpsAssetCommandReceipt": {
    "asset_id": "demo-asset",
    "state": {
      "schema_version": 1,
      "current_revision_id": "demo-current_revision",
      "latest_revision_id": "demo-latest_revision",
      "publish_status": "OFFLINE",
      "availability_status": "AVAILABLE",
      "version": "1"
    }
  },
  "OpsAssetDecision": {
    "decision": "APPROVE",
    "reason": "演示内容"
  },
  "OpsAssetReason": {
    "reason": "演示内容"
  },
  "OpsAssetPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "OpsAssetRevisionPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "RewardSnapshot": {
    "schema_version": 1,
    "config_version_id": "1",
    "benefit_key": "演示内容",
    "rewards": []
  },
  "BenefitGrantReceipt": {
    "coupon_id": "demo-coupon",
    "grant_id": "demo-grant",
    "reward_kind": "POINT",
    "reward_units": "1",
    "reward_code": "PINK"
  },
  "CheckInReceipt": {
    "check_in": {
      "check_in_id": "demo-check_in",
      "business_date": "演示内容",
      "timezone": "演示内容",
      "checked_in_at": "2026-10-14T06:00:00Z",
      "previous_check_in_id": null,
      "streak_days": "1",
      "cumulative_days": "1",
      "rule_version_id": "1"
    },
    "grants": []
  },
  "MemberSummary": {
    "account_id": "demo-account",
    "user_no": "演示内容",
    "display_name": "演示资料",
    "rental_status": "演示内容",
    "level_code": "演示内容",
    "total_growth_units": "1",
    "available_pink_units": "1",
    "first_registered_at": "2026-10-14T06:00:00Z",
    "version": "1"
  },
  "MemberPointAccount": {
    "point_kind": "演示内容",
    "total_earned_points": "1",
    "available_points": "1",
    "reserved_points": "1",
    "latest_sequence": "1"
  },
  "MemberEntitlementAccount": {
    "kind": "演示内容",
    "granted_qty": "1",
    "available_qty": "1",
    "reserved_qty": "1",
    "consumed_qty": "1",
    "refund_frozen_qty": "1",
    "revoked_qty": "1",
    "expired_qty": "1",
    "as_of_at": "2026-10-14T06:00:00Z",
    "next_expiry_at": null,
    "expiry_pending": false
  },
  "MemberPointEntry": {
    "entry_id": "demo-entry",
    "point_kind": "演示内容",
    "account_sequence": "1",
    "action": "演示内容",
    "available_delta": "1",
    "reserved_delta": "1",
    "earned_delta": "1",
    "available_after": "1",
    "reserved_after": "1",
    "source_id": "demo-source",
    "rule_version_id": "1",
    "original_spend_entry_id": null,
    "reversal_of": "演示内容",
    "reason_code": "演示内容",
    "occurred_at": "2026-10-14T06:00:00Z"
  },
  "MemberEntitlementMovement": {
    "movement_id": "demo-movement",
    "kind": "演示内容",
    "account_sequence": "1",
    "lot_id": "demo-lot",
    "action": "演示内容",
    "quantity": "1",
    "available_delta": "1",
    "reserved_delta": "1",
    "consumed_delta": "1",
    "granted_delta": "1",
    "refund_frozen_delta": "1",
    "revoked_delta": "1",
    "expired_delta": "1",
    "available_before_qty": "1",
    "available_after_qty": "1",
    "reversal_of": "演示内容",
    "reason_code": "演示内容",
    "occurred_at": "2026-10-14T06:00:00Z"
  },
  "MemberCheckIn": {
    "check_in_id": "demo-check_in",
    "business_date": "演示内容",
    "timezone": "演示内容",
    "checked_in_at": "2026-10-14T06:00:00Z",
    "previous_check_in_id": null,
    "streak_days": "1",
    "cumulative_days": "1",
    "rule_version_id": "1"
  },
  "MemberAddress": {
    "address_id": "demo-address",
    "province_name": "演示内容",
    "city_name": "演示内容",
    "district_name": "演示内容",
    "is_default": false,
    "status": "演示内容",
    "private_fields": "演示内容",
    "created_at": "2026-10-14T06:00:00Z"
  },
  "MemberAllowance": {
    "allowance_id": "demo-allowance",
    "cycle_key": "演示内容",
    "cycle_start": "2026-10-14T06:00:00Z",
    "cycle_end": "2026-10-14T06:00:00Z",
    "granted_count": "1",
    "reserved_count": "1",
    "consumed_count": "1",
    "revoked_count": "1",
    "available_count": "1",
    "initial_membership_period_id": "demo-initial_membership_period"
  },
  "MemberDossier": {
    "profile": {
      "account_id": "demo-account",
      "user_no": "演示内容",
      "display_name": "演示资料",
      "rental_status": "演示内容",
      "level_code": "演示内容",
      "total_growth_units": "1",
      "available_pink_units": "1",
      "first_registered_at": "2026-10-14T06:00:00Z",
      "version": "1"
    },
    "point_accounts": [],
    "entitlements": [],
    "allowances": [],
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "MemberSummaryPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "OwnPointEntry": {
    "entry_id": "demo-entry",
    "account_id": "demo-account",
    "point_kind": "PINK",
    "account_sequence": "1",
    "action": "演示内容",
    "available_delta": "1",
    "available_before": "1",
    "available_after": "1",
    "reserved_after": "1",
    "occurred_at": "2026-10-14T06:00:00Z",
    "source_kind": "演示内容",
    "source_id": "demo-source",
    "source_draw_id": "demo-source_draw",
    "source_grant_id": "demo-source_grant",
    "reserved_delta": "1",
    "earned_delta": "1"
  },
  "OwnPointStatistics": {
    "timezone": "Asia/Shanghai",
    "day_start": "2026-10-14T06:00:00Z",
    "week_start": "2026-10-14T06:00:00Z",
    "today_earned_delta": "1",
    "week_earned_delta": "1",
    "month_start": "2026-10-14T06:00:00Z",
    "month_increase_units": "1",
    "month_decrease_units": "1"
  },
  "OwnPointEntryPage": {
    "account_id": "demo-account",
    "account": {
      "point_kind": "演示内容",
      "total_earned_points": "1",
      "available_points": "1",
      "reserved_points": "1",
      "latest_sequence": "1"
    },
    "items": [],
    "statistics": {
      "timezone": "Asia/Shanghai",
      "day_start": "2026-10-14T06:00:00Z",
      "week_start": "2026-10-14T06:00:00Z",
      "today_earned_delta": "1",
      "week_earned_delta": "1",
      "month_start": "2026-10-14T06:00:00Z",
      "month_increase_units": "1",
      "month_decrease_units": "1"
    },
    "as_of_at": "2026-10-14T06:00:00Z",
    "page": {
      "next_cursor": "演示内容"
    }
  },
  "MemberPointEntryPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "MemberEntitlementMovementPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "MemberCheckInPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "MemberCoupon": {
    "coupon_id": "demo-coupon",
    "account_id": "demo-account",
    "coupon_type": "DEPOSIT_WAIVER",
    "rights_snapshot": {
      "kind": "DEPOSIT_WAIVER",
      "deposit_waiver": "FULL"
    },
    "status": "AVAILABLE",
    "source_grant_id": "demo-source_grant",
    "source_kind": "CHECK_IN",
    "source_id": "demo-source",
    "source_draw_id": "demo-source_draw",
    "coupon_config_version_id": "1",
    "issued_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": {
      "can_redeem": false
    }
  },
  "MemberCouponPage": {
    "items": [],
    "page": {
      "next_cursor": "演示内容"
    },
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "CouponType": "DEPOSIT_WAIVER",
  "PrizeCode": "DEPOSIT_WAIVER",
  "CouponRights": {
    "kind": "DEPOSIT_WAIVER",
    "deposit_waiver": "FULL"
  },
  "CouponsPolicy": {
    "coupons": [
      {
        "coupon_type": "DEPOSIT_WAIVER",
        "enabled": false,
        "insurance_discount_fen": "1"
      },
      {
        "coupon_type": "DEPOSIT_WAIVER",
        "enabled": false,
        "insurance_discount_fen": "1"
      }
    ]
  },
  "LotteryPolicy": {
    "pool_code": "MAIN",
    "enabled": false,
    "cost_pink_units": "1",
    "no_win_probability_bps": 0,
    "prizes": [
      {
        "prize_code": "DEPOSIT_WAIVER",
        "enabled": false,
        "probability_bps": 0,
        "total_qty": "1",
        "pink_reward_units": "1"
      },
      {
        "prize_code": "DEPOSIT_WAIVER",
        "enabled": false,
        "probability_bps": 0,
        "total_qty": "1",
        "pink_reward_units": "1"
      }
    ]
  },
  "LotteryInventory": {
    "prize_code": "DEPOSIT_WAIVER",
    "total_qty": "1",
    "issued_qty": "1",
    "remaining_qty": "1",
    "version": "1"
  },
  "LoyaltyEffectiveConfig": {
    "config_key": "benefits.coupons",
    "config_version_id": "1",
    "effective_epoch": "1",
    "value": {
      "coupons": [
        {
          "coupon_type": "DEPOSIT_WAIVER",
          "enabled": false,
          "insurance_discount_fen": "1"
        },
        {
          "coupon_type": "DEPOSIT_WAIVER",
          "enabled": false,
          "insurance_discount_fen": "1"
        }
      ]
    },
    "effective_at": "2026-10-14T06:00:00Z",
    "saved_by": "演示内容"
  },
  "LoyaltyEffectiveConfigResult": {
    "current": {
      "config_key": "benefits.coupons",
      "config_version_id": "1",
      "effective_epoch": "1",
      "value": {
        "coupons": [
          {
            "coupon_type": "DEPOSIT_WAIVER",
            "enabled": false,
            "insurance_discount_fen": "1"
          },
          {
            "coupon_type": "DEPOSIT_WAIVER",
            "enabled": false,
            "insurance_discount_fen": "1"
          }
        ]
      },
      "effective_at": "2026-10-14T06:00:00Z",
      "saved_by": "演示内容"
    },
    "inventory": [
      {
        "prize_code": "DEPOSIT_WAIVER",
        "total_qty": "1",
        "issued_qty": "1",
        "remaining_qty": "1",
        "version": "1"
      },
      {
        "prize_code": "DEPOSIT_WAIVER",
        "total_qty": "1",
        "issued_qty": "1",
        "remaining_qty": "1",
        "version": "1"
      }
    ],
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "LoyaltyConfigSaveRequest": {
    "base_effective_epoch": "1",
    "value": {
      "coupons": [
        {
          "coupon_type": "DEPOSIT_WAIVER",
          "enabled": false,
          "insurance_discount_fen": "1"
        },
        {
          "coupon_type": "DEPOSIT_WAIVER",
          "enabled": false,
          "insurance_discount_fen": "1"
        }
      ]
    },
    "reason": "演示内容"
  },
  "LoyaltyConfigSaveResult": {
    "config_version_id": "1",
    "effective_epoch": "1",
    "effective_at": "2026-10-14T06:00:00Z",
    "saved_by": "演示内容",
    "current": {
      "config_key": "benefits.coupons",
      "config_version_id": "1",
      "effective_epoch": "1",
      "value": {
        "coupons": [
          {
            "coupon_type": "DEPOSIT_WAIVER",
            "enabled": false,
            "insurance_discount_fen": "1"
          },
          {
            "coupon_type": "DEPOSIT_WAIVER",
            "enabled": false,
            "insurance_discount_fen": "1"
          }
        ]
      },
      "effective_at": "2026-10-14T06:00:00Z",
      "saved_by": "演示内容"
    },
    "inventory": [
      {
        "prize_code": "DEPOSIT_WAIVER",
        "total_qty": "1",
        "issued_qty": "1",
        "remaining_qty": "1",
        "version": "1"
      },
      {
        "prize_code": "DEPOSIT_WAIVER",
        "total_qty": "1",
        "issued_qty": "1",
        "remaining_qty": "1",
        "version": "1"
      }
    ],
    "replayed": false,
    "operation_event_id": "demo-operation_event"
  },
  "LoyaltyConfigVersion": {
    "config_version_id": "1",
    "config_key": "演示内容",
    "effective_epoch": "1",
    "value": {
      "coupons": [
        {
          "coupon_type": "DEPOSIT_WAIVER",
          "enabled": false,
          "insurance_discount_fen": "1"
        },
        {
          "coupon_type": "DEPOSIT_WAIVER",
          "enabled": false,
          "insurance_discount_fen": "1"
        }
      ]
    },
    "saved_by": "演示内容",
    "effective_at": "2026-10-14T06:00:00Z",
    "reason": "演示内容",
    "content_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "operation_event_id": "demo-operation_event",
    "field_changes": [],
    "inventory_movements": []
  },
  "CouponStatusEvent": {
    "event_id": "demo-event",
    "from_status": "AVAILABLE",
    "to_status": "AVAILABLE",
    "action": "ISSUED",
    "redemption_id": "demo-redemption",
    "request_id": "demo-request",
    "actor_kind": "演示内容",
    "occurred_at": "2026-10-14T06:00:00Z"
  },
  "CouponDetail": {
    "coupon_id": "demo-coupon",
    "account_id": "demo-account",
    "coupon_type": "DEPOSIT_WAIVER",
    "rights_snapshot": {
      "kind": "DEPOSIT_WAIVER",
      "deposit_waiver": "FULL"
    },
    "status": "AVAILABLE",
    "source_grant_id": "demo-source_grant",
    "source_kind": "CHECK_IN",
    "source_id": "demo-source",
    "source_draw_id": "demo-source_draw",
    "coupon_config_version_id": "1",
    "issued_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": {
      "can_redeem": false
    },
    "status_events": [],
    "redemption_id": null,
    "entitlement_lot_id": null,
    "movement_id": null
  },
  "LotteryState": {
    "account_id": "demo-account",
    "enabled": false,
    "blocked_reason": "演示内容",
    "cost_pink_units": "1",
    "available_pink_units": "1",
    "lottery_config_version_id": "1",
    "coupon_config_version_id": "1",
    "prizes": [
      {
        "prize_code": "DEPOSIT_WAIVER",
        "enabled": false,
        "remaining_qty": "1",
        "pink_reward_units": "1",
        "rights_display": {
          "kind": "DEPOSIT_WAIVER",
          "deposit_waiver": "FULL"
        }
      },
      {
        "prize_code": "DEPOSIT_WAIVER",
        "enabled": false,
        "remaining_qty": "1",
        "pink_reward_units": "1",
        "rights_display": {
          "kind": "DEPOSIT_WAIVER",
          "deposit_waiver": "FULL"
        }
      }
    ],
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "LotteryDrawInput": {
    "expected_lottery_config_version_id": "1",
    "expected_coupon_config_version_id": "1",
    "confirmed_cost_pink_units": "1"
  },
  "LotteryPrizeSnapshot": {
    "prize_code": "DEPOSIT_WAIVER",
    "prize_qty": "1",
    "pink_reward_units": "1",
    "coupon_config_version_id": "1"
  },
  "LotteryAttempt": {
    "state": "COMPLETED",
    "result_kind": "WIN",
    "draw_id": "demo-draw",
    "cost_pink_units": "1",
    "prize_code": "DEPOSIT_WAIVER",
    "prize_snapshot": {
      "prize_code": "DEPOSIT_WAIVER",
      "prize_qty": "1",
      "pink_reward_units": "1",
      "coupon_config_version_id": "1"
    },
    "pink_spend_entry_id": "demo-pink_spend_entry",
    "grant_id": "demo-grant",
    "inventory_movement_id": "demo-inventory_movement",
    "balance_after": "1"
  },
  "CouponRedemptionInput": {
    "expected_coupon_version": "1"
  },
  "CouponRedemptionAttempt": {
    "account_id": "demo-account",
    "attempt_id": "demo-attempt",
    "redemption_id": "demo-redemption",
    "state": "RECEIVED",
    "reason_code": "演示内容",
    "coupon_id": "demo-coupon",
    "quantity": "1",
    "entitlement_lot_id": "demo-entitlement_lot",
    "movement_id": "demo-movement",
    "available_before_qty": "1",
    "available_after_qty": "1",
    "expected_coupon_version": "1",
    "received_at": "2026-10-14T06:00:00Z",
    "resolved_at": "2026-10-14T06:00:00Z",
    "lease_expires_at": "2026-10-14T06:00:00Z",
    "request_id": "demo-request",
    "replayed": false
  },
  "BenefitGrantTrace": {
    "grant_id": "demo-grant",
    "account_id": "demo-account",
    "source_kind": "CHECK_IN",
    "source_id": "demo-source",
    "source_rule_version_id": "1",
    "source_award_ordinal": 1,
    "reward_kind": "POINT",
    "reward_code": "PINK",
    "reward_units": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "coupon_ids": [],
    "pink_entry_ids": []
  },
  "LotteryMovement": {
    "movement_id": "demo-movement",
    "prize_code": "DEPOSIT_WAIVER",
    "action": "TOTAL_ADJUSTED",
    "before_total_qty": "1",
    "after_total_qty": "1",
    "before_issued_qty": "1",
    "after_issued_qty": "1",
    "config_version_id": "1",
    "draw_id": "demo-draw",
    "actor_account_id": "demo-actor_account",
    "occurred_at": "2026-10-14T06:00:00Z"
  },
  "PointEntryDetail": {
    "entry_id": "demo-entry",
    "account_id": "demo-account",
    "point_kind": "PINK",
    "account_sequence": "1",
    "action": "演示内容",
    "available_delta": "1",
    "available_before": "1",
    "available_after": "1",
    "reserved_after": "1",
    "occurred_at": "2026-10-14T06:00:00Z",
    "source_kind": "演示内容",
    "source_id": "demo-source",
    "source_draw_id": "demo-source_draw",
    "source_grant_id": "demo-source_grant",
    "reserved_delta": "1",
    "earned_delta": "1"
  },
  "EntitlementMovementDetail": {
    "movement_id": "demo-movement",
    "account_id": "demo-account",
    "kind": "PUBLISH_QUOTA",
    "account_sequence": "1",
    "lot_id": "demo-lot",
    "action": "演示内容",
    "quantity": "1",
    "available_delta": "1",
    "available_before_qty": "1",
    "available_after_qty": "1",
    "occurred_at": "2026-10-14T06:00:00Z",
    "source_kind": "演示内容",
    "source_id": "demo-source",
    "source_redemption_id": "demo-source_redemption"
  },
  "LoyaltyOperationEvent": {
    "event_id": "demo-event",
    "actor_account_id": "demo-actor_account",
    "operation_id": "demo-operation",
    "resource_id": "demo-resource",
    "request_id": "demo-request",
    "http_status": 1,
    "result_code": "演示内容",
    "reason_summary": "演示内容",
    "field_change_summary": {
      "base_effective_epoch": "演示内容",
      "config_key": "演示内容",
      "content_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "current_effective_epoch": "演示内容"
    },
    "result": {
      "config_version_id": "1",
      "effective_epoch": "1",
      "effective_at": "2026-10-14T06:00:00Z",
      "saved_by": "演示内容",
      "current": {
        "config_key": "benefits.coupons",
        "config_version_id": "1",
        "effective_epoch": "1",
        "value": {
          "coupons": [
            {
              "coupon_type": "DEPOSIT_WAIVER",
              "enabled": false,
              "insurance_discount_fen": "1"
            },
            {
              "coupon_type": "DEPOSIT_WAIVER",
              "enabled": false,
              "insurance_discount_fen": "1"
            }
          ]
        },
        "effective_at": "2026-10-14T06:00:00Z",
        "saved_by": "演示内容"
      },
      "inventory": [
        {
          "prize_code": "DEPOSIT_WAIVER",
          "total_qty": "1",
          "issued_qty": "1",
          "remaining_qty": "1",
          "version": "1"
        },
        {
          "prize_code": "DEPOSIT_WAIVER",
          "total_qty": "1",
          "issued_qty": "1",
          "remaining_qty": "1",
          "version": "1"
        }
      ],
      "replayed": false,
      "operation_event_id": "demo-operation_event"
    },
    "occurred_at": "2026-10-14T06:00:00Z",
    "field_changes": []
  },
  "LotteryAttemptPage": {
    "items": [],
    "page": {
      "next_cursor": "演示内容"
    },
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "CouponRedemptionAttemptPage": {
    "items": [],
    "page": {
      "next_cursor": "演示内容"
    },
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "LotteryMovementPage": {
    "items": [],
    "page": {
      "next_cursor": "演示内容"
    },
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "LoyaltyConfigVersionPage": {
    "items": [],
    "page": {
      "next_cursor": "演示内容"
    },
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "PointEntryPage": {
    "items": [],
    "page": {
      "next_cursor": "演示内容"
    },
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "EntitlementMovementPage": {
    "items": [],
    "page": {
      "next_cursor": "演示内容"
    },
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "LotteryInventoryResult": {
    "items": [
      {
        "prize_code": "DEPOSIT_WAIVER",
        "total_qty": "1",
        "issued_qty": "1",
        "remaining_qty": "1",
        "version": "1"
      },
      {
        "prize_code": "DEPOSIT_WAIVER",
        "total_qty": "1",
        "issued_qty": "1",
        "remaining_qty": "1",
        "version": "1"
      }
    ],
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "MemberAddressPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "OpaqueID": "演示内容",
  "BigIntString": "1",
  "Money": {
    "amount_minor": "1",
    "currency": "CNY"
  },
  "Problem": {
    "code": "EXPORT_RANGE_TOO_LARGE",
    "message": "演示内容",
    "request_id": "demo-request",
    "details": {
      "errors": [
        {
          "field": "演示内容",
          "reason": "演示内容",
          "rule": "演示内容"
        }
      ]
    }
  },
  "ErrorCode": "EXPORT_RANGE_TOO_LARGE",
  "CursorPageMeta": {
    "page_size": 1,
    "has_more": false,
    "next_cursor": "演示内容"
  },
  "OffsetPageMeta": {
    "page": 1,
    "page_size": 1,
    "total_items": "1",
    "total_pages": 0
  },
  "ActionDecision": {
    "action_id": "demo-action",
    "aggregate_version": "1",
    "decision": "ACCEPTED",
    "reason_code": "演示内容",
    "blocking_items": [],
    "retry_after": "2026-10-14T06:00:00Z",
    "deadline": "2026-10-14T06:00:00Z"
  },
  "OpsWechatChallenge": {
    "challenge_id": "demo-challenge",
    "purpose": "LOGIN",
    "status": "PENDING",
    "expires_at": "2026-10-14T06:00:00Z",
    "display_name": "演示资料",
    "phone_masked": "1",
    "poll_token": "演示内容",
    "code_image": "演示内容"
  },
  "MembershipLevelsPolicy": {
    "schema_version": 1,
    "levels": [
      {
        "level_code": "演示内容",
        "name": "演示资料",
        "order": 0,
        "upgrade_growth_units": "1",
        "waiver_count_per_month": 0,
        "waiver_mode": "FULL",
        "waiver_cap_fen": "1",
        "eligible_modes": [
          "DAY"
        ],
        "eligible_categories": []
      }
    ]
  },
  "BusinessRewardItem": {
    "kind": "PINK",
    "units": "1",
    "quantity": 1,
    "valid_days": 1,
    "coupon_type": "DEPOSIT_WAIVER"
  },
  "BusinessEffectiveConfig": {
    "config_key": "material.upload_policy",
    "source": "DEFAULT_CODE",
    "schema_version": 1,
    "value": {
      "schema_version": 2,
      "return_instructions": "演示内容",
      "pickup_instructions": "演示内容",
      "grace_seconds": 0,
      "personal_rent_basis_points": 0,
      "loss_beneficiary_basis_points": 0,
      "evidence_templates": [
        {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容"
              }
            }
          ]
        }
      ],
      "template_bindings": [
        {
          "supply_channel": "PERSONAL",
          "fulfillment": "EXPRESS",
          "category_id": "demo-category",
          "template_key": "演示内容"
        }
      ]
    },
    "config_version": {
      "publication_mode": "APPROVAL",
      "config_version_id": "1",
      "config_key": "material.upload_policy",
      "version_no": 1,
      "schema_version": 1,
      "value": {
        "schema_version": 2,
        "return_instructions": "演示内容",
        "pickup_instructions": "演示内容",
        "grace_seconds": 0,
        "personal_rent_basis_points": 0,
        "loss_beneficiary_basis_points": 0,
        "evidence_templates": [
          {
            "template_key": "演示内容",
            "version": "1",
            "title": "演示资料",
            "slots": [
              {
                "slot_key": "演示内容",
                "title": "演示资料",
                "kind": "PHOTO",
                "stage": "PRE_RETURN",
                "min_count": 1,
                "max_count": 1,
                "instruction": "演示内容",
                "sort_order": 0,
                "example": {
                  "object_key": "演示内容",
                  "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  "mime_type": "image/jpeg",
                  "poster_object_key": "演示内容"
                }
              }
            ]
          }
        ],
        "template_bindings": [
          {
            "supply_channel": "PERSONAL",
            "fulfillment": "EXPRESS",
            "category_id": "demo-category",
            "template_key": "演示内容"
          }
        ]
      },
      "content_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "status": "DRAFT",
      "created_by": "演示内容",
      "validated_by": "演示内容",
      "approved_by": "演示内容",
      "published_by": "演示内容",
      "reason": "演示内容",
      "version": 1,
      "created_at": "2026-10-14T06:00:00Z",
      "validated_at": "2026-10-14T06:00:00Z",
      "approved_at": "2026-10-14T06:00:00Z",
      "published_at": "2026-10-14T06:00:00Z"
    },
    "effective_epoch": 1,
    "published_by": "演示内容",
    "published_at": "2026-10-14T06:00:00Z"
  },
  "BusinessConfigVersion": {
    "publication_mode": "APPROVAL",
    "config_version_id": "1",
    "config_key": "material.upload_policy",
    "version_no": 1,
    "schema_version": 1,
    "value": {
      "schema_version": 2,
      "return_instructions": "演示内容",
      "pickup_instructions": "演示内容",
      "grace_seconds": 0,
      "personal_rent_basis_points": 0,
      "loss_beneficiary_basis_points": 0,
      "evidence_templates": [
        {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容"
              }
            }
          ]
        }
      ],
      "template_bindings": [
        {
          "supply_channel": "PERSONAL",
          "fulfillment": "EXPRESS",
          "category_id": "demo-category",
          "template_key": "演示内容"
        }
      ]
    },
    "content_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "status": "DRAFT",
    "created_by": "演示内容",
    "validated_by": "演示内容",
    "approved_by": "演示内容",
    "published_by": "演示内容",
    "reason": "演示内容",
    "version": 1,
    "created_at": "2026-10-14T06:00:00Z",
    "validated_at": "2026-10-14T06:00:00Z",
    "approved_at": "2026-10-14T06:00:00Z",
    "published_at": "2026-10-14T06:00:00Z"
  },
  "CheckInPolicyV2": {
    "schema_version": 2,
    "timezone": "Asia/Shanghai",
    "daily_rewards": [],
    "first_rewards": [],
    "milestones": []
  },
  "EntitlementCatalogPolicyV2": {
    "schema_version": 2,
    "offers": [
      {
        "offer_code": "演示内容",
        "name": "演示资料",
        "cny_price_fen": "1",
        "pink_price": "1",
        "min_quantity": 1,
        "max_quantity": 1,
        "refund_policy": "NONE",
        "items": [
          {
            "kind": "CONTRACT",
            "quantity": "1",
            "valid_days": 1
          }
        ]
      }
    ]
  },
  "RentalCreationDefaultsPolicy": {
    "schema_version": 1,
    "minimum_hourly_hours": 12,
    "minimum_daily_days": 3,
    "pay_score_enabled": false,
    "pay_score_threshold": 1
  },
  "OpsWechatBinding": {
    "status": "BOUND",
    "nickname": "演示内容",
    "avatar_material_id": null,
    "bound_at": null
  },
  "IAMAccountView": {
    "display_name": "演示资料",
    "wechat_binding": {
      "status": "BOUND",
      "nickname": "演示内容",
      "avatar_material_id": null,
      "bound_at": null
    },
    "account_id": "demo-account",
    "audience": "MINIPROGRAM",
    "roles": [],
    "permissions": [],
    "scopes": []
  },
  "IAMSessionResponse": {
    "access_token": "演示内容",
    "refresh_token": "演示内容",
    "token_type": "Bearer",
    "expires_in": 1,
    "account": {
      "display_name": "演示资料",
      "wechat_binding": {
        "status": "BOUND",
        "nickname": "演示内容",
        "avatar_material_id": null,
        "bound_at": null
      },
      "account_id": "demo-account",
      "audience": "MINIPROGRAM",
      "roles": [],
      "permissions": [],
      "scopes": []
    }
  },
  "OnSiteResponsible": "演示内容",
  "OpenAllChallengeRequest": {
    "reason": "演示内容",
    "on_site_responsible": "演示内容",
    "confirmed_device_id": "1"
  },
  "OpenAllCommandRequest": {
    "challenge_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "h",
      "7": "a",
      "8": "l",
      "9": "l",
      "10": "e",
      "11": "n",
      "12": "g",
      "13": "e"
    },
    "proof": "1"
  },
  "OpenAllChallenge": {
    "challenge_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "h",
      "7": "a",
      "8": "l",
      "9": "l",
      "10": "e",
      "11": "n",
      "12": "g",
      "13": "e"
    },
    "expires_at": "2026-10-14T06:00:00Z",
    "masked_destination": "演示内容",
    "status": "PENDING",
    "delivery_status": "QUEUED",
    "remaining_attempts": 0,
    "provider_mode": "REAL"
  },
  "RecoveryRequest": {
    "reason": "演示内容",
    "on_site_responsible": "演示内容",
    "evidence_material_ids": [
      {
        "0": "演",
        "1": "示",
        "2": "内",
        "3": "容"
      }
    ],
    "disposition": "SAFE_TO_RELEASE_WITHOUT_REPLAY"
  },
  "RecoveryRecord": {
    "recovery_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "r",
      "6": "e",
      "7": "c",
      "8": "o",
      "9": "v",
      "10": "e",
      "11": "r",
      "12": "y"
    },
    "command_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "o",
      "7": "m",
      "8": "m",
      "9": "a",
      "10": "n",
      "11": "d"
    },
    "cabinet_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "a",
      "7": "b",
      "8": "i",
      "9": "n",
      "10": "e",
      "11": "t"
    },
    "actor_account_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "a",
      "6": "c",
      "7": "t",
      "8": "o",
      "9": "r",
      "10": "_",
      "11": "a",
      "12": "c",
      "13": "c",
      "14": "o",
      "15": "u",
      "16": "n",
      "17": "t"
    },
    "reauthenticated_at": "2026-10-14T06:00:00Z",
    "on_site_responsible": "演示内容",
    "reason": "演示内容",
    "evidence_material_ids": [
      {
        "0": "演",
        "1": "示",
        "2": "内",
        "3": "容"
      }
    ],
    "disposition": "SAFE_TO_RELEASE_WITHOUT_REPLAY",
    "provider_mode": "REAL",
    "created_at": "2026-10-14T06:00:00Z"
  },
  "CabinetCommand": {
    "command_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "o",
      "7": "m",
      "8": "m",
      "9": "a",
      "10": "n",
      "11": "d"
    },
    "cabinet_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "a",
      "7": "b",
      "8": "i",
      "9": "n",
      "10": "e",
      "11": "t"
    },
    "command_type": "OPEN_ONE",
    "execution_status": "REQUESTED",
    "observation_status": "NOT_OBSERVED",
    "resolution_status": "UNRESOLVED",
    "provider_mode": "REAL",
    "topology_version": 1,
    "occupancy_revision": "演示内容",
    "targets": [
      {
        "compartment_id": {
          "0": "d",
          "1": "e",
          "2": "m",
          "3": "o",
          "4": "-",
          "5": "c",
          "6": "o",
          "7": "m",
          "8": "p",
          "9": "a",
          "10": "r",
          "11": "t",
          "12": "m",
          "13": "e",
          "14": "n",
          "15": "t"
        },
        "compartment_no": 1
      }
    ],
    "reason": "演示内容",
    "on_site_responsible": "演示内容",
    "observed_open_count": 0,
    "result_code": "演示内容",
    "accepted_at": null,
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": 1,
    "allowed_actions": {
      "recover": false
    }
  },
  "TargetCompartment": {
    "compartment_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "o",
      "7": "m",
      "8": "p",
      "9": "a",
      "10": "r",
      "11": "t",
      "12": "m",
      "13": "e",
      "14": "n",
      "15": "t"
    },
    "compartment_no": 1
  },
  "BlockingItem": {
    "code": "演示内容",
    "message": "演示内容",
    "subject_type": "演示内容",
    "subject_id": "demo-subject"
  },
  "ResourceID": {
    "0": "演",
    "1": "示",
    "2": "内",
    "3": "容"
  },
  "DeviceID": "1",
  "CabinetCreateRequest": {
    "provider_device_id": "1",
    "cabinet_name": "演示内容",
    "description": "演示内容",
    "compartment_count": 1,
    "reason": "演示内容",
    "merchant_id": "demo-merchant"
  },
  "CabinetUpdateRequest": {
    "cabinet_name": "演示内容",
    "description": "演示内容",
    "reason": "演示内容"
  },
  "CabinetActivateRequest": {
    "reason": "演示内容"
  },
  "CompartmentAdjustmentRequest": {
    "target_count": 1,
    "reason": "演示内容",
    "physical_layout_confirmed": true
  },
  "ReasonRequest": {
    "reason": "演示内容"
  },
  "CabinetAllowedActions": {
    "update": false,
    "activate": false,
    "deactivate": false,
    "archive": false,
    "restore": false,
    "observe": false,
    "open_one": false,
    "open_all": false,
    "resize": false,
    "sync_cover": false
  },
  "CabinetProviderAction": {
    "action": "ONLINE",
    "enabled": false,
    "reason_code": "演示内容",
    "message": "演示内容",
    "risk_level": "LOW",
    "observed_at": "2026-10-14T06:00:00Z",
    "cabinet_version": 1
  },
  "CabinetProviderActionList": {
    "items": [
      {
        "action": "ONLINE",
        "enabled": false,
        "reason_code": "演示内容",
        "message": "演示内容",
        "risk_level": "LOW",
        "observed_at": "2026-10-14T06:00:00Z",
        "cabinet_version": 1
      },
      {
        "action": "ONLINE",
        "enabled": false,
        "reason_code": "演示内容",
        "message": "演示内容",
        "risk_level": "LOW",
        "observed_at": "2026-10-14T06:00:00Z",
        "cabinet_version": 1
      }
    ]
  },
  "CabinetProviderQuery": {
    "query_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "q",
      "6": "u",
      "7": "e",
      "8": "r",
      "9": "y"
    },
    "cabinet_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "a",
      "7": "b",
      "8": "i",
      "9": "n",
      "10": "e",
      "11": "t"
    },
    "kind": "ONLINE_QUERY",
    "compartment_no": 1,
    "status": "QUEUED",
    "connectivity_status": "ONLINE",
    "door_status": "OPEN",
    "result_code": "演示内容",
    "observed_at": null,
    "created_at": "2026-10-14T06:00:00Z",
    "started_at": null,
    "finished_at": null
  },
  "CabinetProviderOperation": {
    "operation_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "o",
      "6": "p",
      "7": "e",
      "8": "r",
      "9": "a",
      "10": "t",
      "11": "i",
      "12": "o",
      "13": "n"
    },
    "kind": "ONLINE_QUERY",
    "target": "演示内容",
    "request_status": "QUEUED",
    "observation_status": "演示内容",
    "connectivity_status": "ONLINE",
    "created_at": "2026-10-14T06:00:00Z",
    "detail_ref": "演示内容"
  },
  "CabinetProviderOperationPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "Cabinet": {
    "cabinet_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "a",
      "7": "b",
      "8": "i",
      "9": "n",
      "10": "e",
      "11": "t"
    },
    "provider_code": "QIANMING",
    "provider_mode": "REAL",
    "provider_device_id": "1",
    "cabinet_name": "演示内容",
    "description": "演示内容",
    "deployment_site_name": "演示内容",
    "deployment_site_address": "演示内容",
    "compartment_count": 1,
    "lifecycle_status": "INACTIVE",
    "connectivity_status": "UNKNOWN",
    "connectivity_checked_at": null,
    "last_online_at": null,
    "last_success_at": null,
    "connectivity_stale": false,
    "occupancy_summary": {
      "current": 0,
      "available": 0,
      "reserved": 0,
      "occupied": 0,
      "out_of_service": 0
    },
    "version": 1,
    "topology_version": 1,
    "topology_verification": "REQUIRED",
    "topology_confirmed_by": {
      "0": "演",
      "1": "示",
      "2": "内",
      "3": "容"
    },
    "topology_confirmed_at": null,
    "topology_confirmed_version": 1,
    "initial_observation_command_id": null,
    "activation_readiness": {
      "eligible": false,
      "blocking_items": [],
      "topology_version": 1,
      "pending_compartment_nos": [],
      "checked_at": "2026-10-14T06:00:00Z"
    },
    "active_command_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "a",
      "6": "c",
      "7": "t",
      "8": "i",
      "9": "v",
      "10": "e",
      "11": "_",
      "12": "c",
      "13": "o",
      "14": "m",
      "15": "m",
      "16": "a",
      "17": "n",
      "18": "d"
    },
    "allowed_actions": {
      "update": false,
      "activate": false,
      "deactivate": false,
      "archive": false,
      "restore": false,
      "observe": false,
      "open_one": false,
      "open_all": false,
      "resize": false,
      "sync_cover": false
    },
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "merchant_id": "demo-merchant",
    "responsible_lessor_id": "demo-responsible_lessor",
    "merchant_name": "演示内容",
    "address": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "detail_address": "演示内容",
      "phone_dial": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      },
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容",
      "location_verified_at": null
    },
    "cover": {
      "sync_id": null,
      "status": "QUEUED",
      "cover_url": null,
      "code_ready": false,
      "accepted_at": null,
      "error_code": "演示内容",
      "preview_is_previous": false
    }
  },
  "CabinetCompartment": {
    "compartment_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "o",
      "7": "m",
      "8": "p",
      "9": "a",
      "10": "r",
      "11": "t",
      "12": "m",
      "13": "e",
      "14": "n",
      "15": "t"
    },
    "cabinet_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "c",
      "6": "a",
      "7": "b",
      "8": "i",
      "9": "n",
      "10": "e",
      "11": "t"
    },
    "compartment_no": 1,
    "service_status": "ACTIVE",
    "business_occupancy_status": "UNASSIGNED",
    "door_status": "UNKNOWN",
    "door_observed_at": null,
    "door_observation_source": "演示内容",
    "door_error_code": "演示内容",
    "commissioned_by": "演示内容",
    "commissioned_at": null,
    "commissioned_topology_version": 1,
    "version": 1,
    "topology_status": "IN_TOPOLOGY",
    "retired_at": null,
    "last_topology_version": 1,
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "occupant": {
      "asset_id": {
        "0": "d",
        "1": "e",
        "2": "m",
        "3": "o",
        "4": "-",
        "5": "a",
        "6": "s",
        "7": "s",
        "8": "e",
        "9": "t"
      },
      "asset_no": "演示内容",
      "display_name": "演示资料",
      "credential_id": {
        "0": "d",
        "1": "e",
        "2": "m",
        "3": "o",
        "4": "-",
        "5": "c",
        "6": "r",
        "7": "e",
        "8": "d",
        "9": "e",
        "10": "n",
        "11": "t",
        "12": "i",
        "13": "a",
        "14": "l"
      }
    },
    "rfid_status": "UNKNOWN",
    "observed_rfid_code": "演示内容",
    "rfid_checked_at": null
  },
  "BusinessOccupancyStatus": "UNASSIGNED",
  "DoorStatus": "UNKNOWN",
  "CabinetOccupancySummary": {
    "current": 0,
    "available": 0,
    "reserved": 0,
    "occupied": 0,
    "out_of_service": 0
  },
  "CabinetStatistics": {
    "total": 0,
    "active": 0,
    "inactive": 0,
    "archived": 0,
    "online": 0,
    "offline": 0,
    "unknown": 0,
    "occupied": 0,
    "available": 0,
    "full": 0
  },
  "CabinetPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    },
    "statistics": {
      "total": 0,
      "active": 0,
      "inactive": 0,
      "archived": 0,
      "online": 0,
      "offline": 0,
      "unknown": 0,
      "occupied": 0,
      "available": 0,
      "full": 0
    }
  },
  "CabinetCompartmentList": {
    "items": []
  },
  "CabinetLocation": {
    "latitude": "1",
    "longitude": "1",
    "coordinate_system": "GCJ02",
    "source": "MAP_PICK"
  },
  "CabinetAddressInput": {
    "dataset_id": "demo-dataset",
    "province_id": "demo-province",
    "city_id": "demo-city",
    "district_id": "demo-district",
    "detail_address": "演示内容",
    "phone_dial": "1",
    "location": {
      "latitude": "1",
      "longitude": "1",
      "coordinate_system": "GCJ02",
      "source": "MAP_PICK"
    }
  },
  "CabinetAddress": {
    "dataset_id": "demo-dataset",
    "province_id": "demo-province",
    "city_id": "demo-city",
    "district_id": "demo-district",
    "detail_address": "演示内容",
    "phone_dial": "1",
    "location": {
      "latitude": "1",
      "longitude": "1",
      "coordinate_system": "GCJ02",
      "source": "MAP_PICK"
    },
    "province_name": "演示内容",
    "city_name": "演示内容",
    "district_name": "演示内容",
    "location_verified_at": null
  },
  "CabinetActivationReadiness": {
    "eligible": false,
    "blocking_items": [],
    "topology_version": 1,
    "pending_compartment_nos": [],
    "checked_at": "2026-10-14T06:00:00Z"
  },
  "CabinetCover": {
    "sync_id": null,
    "status": "QUEUED",
    "cover_url": null,
    "code_ready": false,
    "accepted_at": null,
    "error_code": "演示内容",
    "preview_is_previous": false
  },
  "CabinetCoverSyncRequest": {
    "original_sync_id": "demo-original_sync",
    "confirm_resend": true
  },
  "CabinetCoverSyncReceipt": {
    "sync_id": "demo-sync"
  },
  "AddressLocation": {
    "latitude": "1",
    "longitude": "1",
    "coordinate_system": "GCJ02",
    "source": "MAP_PICK"
  },
  "AddressInput": {
    "dataset_id": "demo-dataset",
    "province_id": "demo-province",
    "city_id": "demo-city",
    "district_id": "demo-district",
    "detail_address": "演示内容",
    "recipient_name": "演示内容",
    "phone_country_code": "1",
    "phone": "1",
    "is_default": false,
    "location": {
      "latitude": "1",
      "longitude": "1",
      "coordinate_system": "GCJ02",
      "source": "MAP_PICK"
    }
  },
  "ReasonItem": {
    "code": "演示内容",
    "message": "演示内容",
    "field": "演示内容"
  },
  "AddressAction": {
    "code": "UPDATE",
    "enabled": false,
    "blocked_reasons": []
  },
  "OwnAddress": {
    "dataset_id": "demo-dataset",
    "province_id": "demo-province",
    "city_id": "demo-city",
    "district_id": "demo-district",
    "detail_address": "演示内容",
    "recipient_name": "演示内容",
    "phone_country_code": "1",
    "phone": "1",
    "is_default": false,
    "location": {
      "latitude": "1",
      "longitude": "1",
      "coordinate_system": "GCJ02",
      "source": "MAP_PICK"
    },
    "address_id": "demo-address",
    "province_name": "演示内容",
    "city_name": "演示内容",
    "district_name": "演示内容",
    "status": "ACTIVE",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "location_verified_at": "2026-10-14T06:00:00Z",
    "allowed_actions": [],
    "blocked_reasons": []
  },
  "OwnAddressList": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "AddressReceipt": {
    "address_id": "demo-address",
    "version": "1",
    "status": "ACTIVE",
    "is_default": false
  },
  "ArchiveAddressRequest": {
    "reason": "演示内容"
  },
  "EmptyAddressCommand": {},
  "OpsAssetRFIDInput": {
    "rfid_code": "演示内容"
  },
  "OpsAssetRFIDReceipt": {
    "asset_id": "demo-asset",
    "rfid_code": "演示内容",
    "version": "1"
  },
  "OpsAssetClientPosition": {
    "latitude": "1",
    "longitude": "1",
    "coordinate_system": "GCJ02",
    "source": "WECHAT_CLIENT"
  },
  "OwnRentalAssetAction": {
    "code": "VIEW",
    "enabled": false,
    "blocked_reasons": []
  },
  "OwnRentalAssetItem": {
    "resource_kind": "ASSET",
    "resource_id": "demo-resource",
    "asset_id": "demo-asset",
    "draft_id": "demo-draft",
    "origin_kind": "CREATE",
    "product_id": "demo-product",
    "product_name": "演示内容",
    "display_name": "演示资料",
    "state": "DRAFT",
    "publish_status": "ONLINE",
    "availability_status": "AVAILABLE",
    "latest_review_status": "PENDING",
    "current_revision_id": "demo-current_revision",
    "latest_revision_id": "demo-latest_revision",
    "rental_unit": "HOUR",
    "unit_price_fen": "1",
    "deposit_fen": "1",
    "cover_material_id": "demo-cover_material",
    "delivery_methods": [],
    "editable_draft_id": "demo-editable_draft",
    "allowed_actions": [],
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": "1"
  },
  "OwnRentalAssetPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "OwnRentalAssetDetail": {
    "item": {
      "resource_kind": "ASSET",
      "resource_id": "demo-resource",
      "asset_id": "demo-asset",
      "draft_id": "demo-draft",
      "origin_kind": "CREATE",
      "product_id": "demo-product",
      "product_name": "演示内容",
      "display_name": "演示资料",
      "state": "DRAFT",
      "publish_status": "ONLINE",
      "availability_status": "AVAILABLE",
      "latest_review_status": "PENDING",
      "current_revision_id": "demo-current_revision",
      "latest_revision_id": "demo-latest_revision",
      "rental_unit": "HOUR",
      "unit_price_fen": "1",
      "deposit_fen": "1",
      "cover_material_id": "demo-cover_material",
      "delivery_methods": [],
      "editable_draft_id": "demo-editable_draft",
      "allowed_actions": [],
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z",
      "version": "1"
    },
    "current_revision": {
      "revision_id": "demo-revision",
      "asset_id": "demo-asset",
      "revision_no": "1",
      "product_id": "demo-product",
      "display_name": "演示资料",
      "rental_unit": "HOUR",
      "unit_price_fen": "1",
      "deposit_fen": "1",
      "minimum_units": "1",
      "reference_value_fen": "1",
      "currency": "CNY",
      "available_from": "2026-10-14T06:00:00Z",
      "available_until": "2026-10-14T06:00:00Z",
      "timezone": "Asia/Shanghai",
      "rule_version_id": "1",
      "eligibility_rule_version_id": "1",
      "identity_check_id": "demo-identity_check",
      "submitted_by": "演示内容",
      "submitted_at": "2026-10-14T06:00:00Z",
      "review_status": "PENDING",
      "reviewed_by": "演示内容",
      "reviewed_at": "2026-10-14T06:00:00Z",
      "review_reason": "演示内容",
      "condition": "演示内容",
      "defect_description": "演示内容",
      "accessories_text": "演示内容",
      "description": "演示内容",
      "product_snapshot": {
        "schema_version": 1,
        "product_id": "demo-product",
        "product_no": "演示内容",
        "brand_id": "demo-brand",
        "brand_name": "演示内容",
        "category_id": "demo-category",
        "category_name": "演示内容",
        "model_name": "演示内容",
        "product_name": "演示内容",
        "tags": [],
        "cover_material_id": "demo-cover_material"
      },
      "pricing_guidance_snapshot": {
        "schema_version": 1,
        "config_version_id": "1",
        "min_unit_price_fen": "1",
        "max_unit_price_fen": "1",
        "recommended_unit_price_fen": "1",
        "rental_mode": "HOUR",
        "captured_at": "2026-10-14T06:00:00Z"
      },
      "publication_region": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "province_name": "演示内容",
        "city_name": "演示内容",
        "district_name": "演示内容"
      },
      "media": [],
      "delivery_options": []
    },
    "latest_revision": {
      "revision_id": "demo-revision",
      "asset_id": "demo-asset",
      "revision_no": "1",
      "product_id": "demo-product",
      "display_name": "演示资料",
      "rental_unit": "HOUR",
      "unit_price_fen": "1",
      "deposit_fen": "1",
      "minimum_units": "1",
      "reference_value_fen": "1",
      "currency": "CNY",
      "available_from": "2026-10-14T06:00:00Z",
      "available_until": "2026-10-14T06:00:00Z",
      "timezone": "Asia/Shanghai",
      "rule_version_id": "1",
      "eligibility_rule_version_id": "1",
      "identity_check_id": "demo-identity_check",
      "submitted_by": "演示内容",
      "submitted_at": "2026-10-14T06:00:00Z",
      "review_status": "PENDING",
      "reviewed_by": "演示内容",
      "reviewed_at": "2026-10-14T06:00:00Z",
      "review_reason": "演示内容",
      "condition": "演示内容",
      "defect_description": "演示内容",
      "accessories_text": "演示内容",
      "description": "演示内容",
      "product_snapshot": {
        "schema_version": 1,
        "product_id": "demo-product",
        "product_no": "演示内容",
        "brand_id": "demo-brand",
        "brand_name": "演示内容",
        "category_id": "demo-category",
        "category_name": "演示内容",
        "model_name": "演示内容",
        "product_name": "演示内容",
        "tags": [],
        "cover_material_id": "demo-cover_material"
      },
      "pricing_guidance_snapshot": {
        "schema_version": 1,
        "config_version_id": "1",
        "min_unit_price_fen": "1",
        "max_unit_price_fen": "1",
        "recommended_unit_price_fen": "1",
        "rental_mode": "HOUR",
        "captured_at": "2026-10-14T06:00:00Z"
      },
      "publication_region": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "province_name": "演示内容",
        "city_name": "演示内容",
        "district_name": "演示内容"
      },
      "media": [],
      "delivery_options": []
    },
    "publication_blockers": [],
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "CheckInHistoryGrant": {
    "coupon_id": "demo-coupon",
    "grant_id": "demo-grant",
    "reward_kind": "POINT",
    "reward_units": "1",
    "reward_code": "PINK"
  },
  "CheckInHistoryEntry": {
    "check_in": {
      "check_in_id": "demo-check_in",
      "business_date": "演示内容",
      "timezone": "演示内容",
      "checked_in_at": "2026-10-14T06:00:00Z",
      "previous_check_in_id": null,
      "streak_days": "1",
      "cumulative_days": "1",
      "rule_version_id": "1"
    },
    "grants": []
  },
  "CheckInMonth": {
    "month": "1",
    "today": "演示内容",
    "items": []
  },
  "CurrentCheckInRule": {
    "rule_version_id": "1",
    "policy": {
      "schema_version": 2,
      "timezone": "Asia/Shanghai",
      "daily_rewards": [],
      "first_rewards": [],
      "milestones": []
    }
  },
  "PublishRequest": {
    "config_key": "membership.levels",
    "schema_version": 1,
    "expected_epoch": 0,
    "value": {
      "schema_version": 2,
      "return_instructions": "演示内容",
      "pickup_instructions": "演示内容",
      "grace_seconds": 0,
      "personal_rent_basis_points": 0,
      "loss_beneficiary_basis_points": 0,
      "evidence_templates": [
        {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容"
              }
            }
          ]
        }
      ],
      "template_bindings": [
        {
          "supply_channel": "PERSONAL",
          "fulfillment": "EXPRESS",
          "category_id": "demo-category",
          "template_key": "演示内容"
        }
      ]
    },
    "reason": "演示内容"
  },
  "PolicyUnits": "1",
  "RentalRequirementsPolicy": {
    "schema_version": 1,
    "rules": [
      {
        "business_mode": "C2C",
        "supply_type": "PERSONAL",
        "rental_mode": "HOUR",
        "identity_required": false,
        "contract_required": false,
        "allowed_delivery_methods": [
          "EXPRESS"
        ],
        "payment_deadline_seconds": 1,
        "approval_deadline_seconds": 1
      }
    ]
  },
  "RentalRequirementsRule": {
    "business_mode": "C2C",
    "supply_type": "PERSONAL",
    "rental_mode": "HOUR",
    "identity_required": false,
    "contract_required": false,
    "allowed_delivery_methods": [
      "EXPRESS"
    ],
    "payment_deadline_seconds": 1,
    "approval_deadline_seconds": 1
  },
  "RentalBillingPolicy": {
    "schema_version": 1,
    "rules": [
      {
        "business_mode": "C2C",
        "supply_type": "PERSONAL",
        "rental_mode": "HOUR",
        "unit": "HOUR",
        "rounding": "CEIL_UNIT",
        "minimum_units": 1,
        "grace_seconds": 0,
        "cap_fen": "1",
        "overdue_enabled": false,
        "overdue_unit_price_fen": "1"
      }
    ]
  },
  "RentalBillingRule": {
    "business_mode": "C2C",
    "supply_type": "PERSONAL",
    "rental_mode": "HOUR",
    "unit": "HOUR",
    "rounding": "CEIL_UNIT",
    "minimum_units": 1,
    "grace_seconds": 0,
    "cap_fen": "1",
    "overdue_enabled": false,
    "overdue_unit_price_fen": "1"
  },
  "RentalDepositPolicy": {
    "schema_version": 1,
    "rules": [
      {
        "supply_type": "PERSONAL",
        "rental_mode": "HOUR",
        "allowed_methods": [
          "CASH"
        ],
        "pink_units_per_fen": {
          "numerator": "1",
          "denominator": "1"
        },
        "pink_max_waiver_fen": "1"
      }
    ]
  },
  "UnitRatio": {
    "numerator": "1",
    "denominator": "1"
  },
  "RentalDepositRule": {
    "supply_type": "PERSONAL",
    "rental_mode": "HOUR",
    "allowed_methods": [
      "CASH"
    ],
    "pink_units_per_fen": {
      "numerator": "1",
      "denominator": "1"
    },
    "pink_max_waiver_fen": "1"
  },
  "MembershipLevel": {
    "level_code": "演示内容",
    "name": "演示资料",
    "order": 0,
    "upgrade_growth_units": "1",
    "waiver_count_per_month": 0,
    "waiver_mode": "FULL",
    "waiver_cap_fen": "1",
    "eligible_modes": [
      "DAY"
    ],
    "eligible_categories": []
  },
  "EntitlementCatalogPolicy": {
    "schema_version": 1,
    "offers": [
      {
        "offer_code": "演示内容",
        "kind": "CONTRACT",
        "cost_unit": "CNY",
        "unit_price": "1",
        "min_quantity": 1,
        "max_quantity": 1,
        "valid_days": 1,
        "refund_policy": "CONTRACT_UNUSED_FULL"
      }
    ]
  },
  "EntitlementOffer": {
    "offer_code": "演示内容",
    "kind": "CONTRACT",
    "cost_unit": "CNY",
    "unit_price": "1",
    "min_quantity": 1,
    "max_quantity": 1,
    "valid_days": 1,
    "refund_policy": "CONTRACT_UNUSED_FULL"
  },
  "SettlementRulesPolicy": {
    "schema_version": 1,
    "fee_basis": "COLLECTED_RENT",
    "platform_fee_basis_points": 0,
    "wallet_only": true,
    "withdrawal_min_fen": "1",
    "withdrawal_max_fen": "1"
  },
  "CabinetCredentialPolicy": {
    "schema_version": 1,
    "digits": 6,
    "code_ttl_seconds": null,
    "verification_window_seconds": 60,
    "max_failed_attempts": 1,
    "session_ttl_seconds": 60,
    "replay_policy": "QUERY_ORIGINAL"
  },
  "AssetPriceGuidancePolicy": {
    "schema_version": 1,
    "rules": []
  },
  "AssetPriceGuidanceRule": {
    "category_id": "demo-category",
    "rental_unit": "HOUR",
    "min_unit_price_fen": "1",
    "max_unit_price_fen": "1",
    "recommended_unit_price_fen": "1"
  },
  "RewardItem": {
    "kind": "PINK",
    "units": "1",
    "quantity": 1,
    "valid_days": 1,
    "coupon_type": "DEPOSIT_WAIVER"
  },
  "CheckInPolicy": {
    "schema_version": 2,
    "timezone": "Asia/Shanghai",
    "daily_rewards": [],
    "first_rewards": [],
    "milestones": []
  },
  "BenefitCatalogPolicy": {
    "schema_version": 1,
    "tasks": [],
    "redemptions": []
  },
  "BenefitTask": {
    "benefit_code": "演示内容",
    "task_code": "REGISTER",
    "period": "LIFETIME",
    "limit": 1,
    "rewards": []
  },
  "BenefitRedemption": {
    "offer_code": "演示内容",
    "cost_pink_units": "1",
    "period": "LIFETIME",
    "limit": 1,
    "rewards": [
      {
        "kind": "PINK",
        "units": "1",
        "quantity": 1,
        "valid_days": 1,
        "coupon_type": "DEPOSIT_WAIVER"
      }
    ]
  },
  "LotteryRulesPolicy": {
    "pool_code": "MAIN",
    "enabled": false,
    "cost_pink_units": "1",
    "no_win_probability_bps": 0,
    "prizes": [
      {
        "prize_code": "DEPOSIT_WAIVER",
        "enabled": false,
        "probability_bps": 0,
        "total_qty": "1",
        "pink_reward_units": "1"
      },
      {
        "prize_code": "DEPOSIT_WAIVER",
        "enabled": false,
        "probability_bps": 0,
        "total_qty": "1",
        "pink_reward_units": "1"
      }
    ]
  },
  "ClientResourcesPolicy": {
    "schema_version": 1,
    "client": "MINIPROGRAM",
    "channel": "演示内容",
    "entries": [
      {
        "resource_key": "演示内容",
        "locale": "演示内容",
        "theme": "LIGHT",
        "material_id": "demo-material",
        "min_client_version": "1"
      }
    ]
  },
  "ClientResource": {
    "resource_key": "演示内容",
    "locale": "演示内容",
    "theme": "LIGHT",
    "material_id": "demo-material",
    "min_client_version": "1"
  },
  "WechatMessageScenesPolicy": {
    "schema_version": 1,
    "scenes": []
  },
  "WechatMessageScene": {
    "scene": "PAYMENT_CONFIRMED",
    "template_id": "demo-template",
    "parameter_map": [
      {
        "provider_parameter": "演示内容",
        "source": "ORDER_NO"
      }
    ],
    "page_path": "演示内容",
    "enabled": false
  },
  "WechatMessageParameter": {
    "provider_parameter": "演示内容",
    "source": "ORDER_NO"
  },
  "AdministrativeRegionsPolicy": {
    "schema_version": 1,
    "dataset_code": "演示内容",
    "source_name": "演示内容",
    "source_material_id": "demo-source_material",
    "source_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "imported_count": 1,
    "imported_at": "2026-10-14T06:00:00Z"
  },
  "StorageRoutePolicy": {
    "schema_version": 1,
    "provider": "ALIYUN_OSS",
    "region_id": "demo-region",
    "bucket": "演示内容",
    "endpoint_alias": "演示内容",
    "object_prefix": "演示内容",
    "credential_ref": "演示内容",
    "kms_key_ref": "演示内容",
    "sse_mode": "SSE-OSS",
    "public_cdn_host": "演示内容",
    "object_versioning_enabled": false
  },
  "PayoutProviderPolicy": {
    "schema_version": 1,
    "provider": "WECHAT",
    "product_code": "演示内容",
    "appid": "演示内容",
    "mchid": "演示内容",
    "credential_ref": "演示内容",
    "notify_route_key": "WECHAT_PAYOUT",
    "requires_payee_authorization": false,
    "verified_at": "2026-10-14T06:00:00Z",
    "verification_material_id": "demo-verification_material",
    "enabled": false
  },
  "AgreementRequirementsPolicy": {
    "schema_version": 1,
    "requirements": [
      {
        "scene": "REGISTER",
        "kind": "USER_AGREEMENT",
        "document_id": "demo-document",
        "required": false
      }
    ]
  },
  "AgreementRequirement": {
    "scene": "REGISTER",
    "kind": "USER_AGREEMENT",
    "document_id": "demo-document",
    "required": false
  },
  "ServiceCoveragePolicy": {
    "schema_version": 1,
    "coverages": []
  },
  "ServiceCoverage": {
    "code": "GUARD",
    "name": "演示资料",
    "fee_fen": "1",
    "maximum_cover_fen": "1",
    "terms_document_id": "demo-terms_document"
  },
  "MaterialUploadPolicyV2": {
    "allowed_classes": [
      "PROFILE_IMAGE"
    ],
    "allowed_mime_types": [
      "image/jpeg"
    ],
    "max_bytes": 1,
    "upload_ttl_seconds": 30,
    "scan_required": true,
    "class_limits": [
      {
        "class": "PROFILE_IMAGE",
        "mimes": [
          "image/jpeg"
        ],
        "max_bytes": 1,
        "max_duration_ms": 1,
        "processing_required": false
      }
    ]
  },
  "MaterialClassLimit": {
    "class": "PROFILE_IMAGE",
    "mimes": [
      "image/jpeg"
    ],
    "max_bytes": 1,
    "max_duration_ms": 1,
    "processing_required": false
  },
  "SMSChallengePolicyV2": {
    "allowed_scenes": [
      "OPS_LOGIN"
    ],
    "digits": 6,
    "ttl_seconds": 60,
    "cooldown_seconds": 30,
    "max_attempts": 3,
    "phone_daily_limit": 1,
    "ip_daily_limit": 1,
    "template_versions": [
      {
        "scene": "OPS_LOGIN",
        "template_version_id": "1"
      }
    ]
  },
  "SMSTemplateBinding": {
    "scene": "OPS_LOGIN",
    "template_version_id": "1"
  },
  "AssetPublicationEligibilityPolicy": {
    "schema_version": 1,
    "minimum_level_code": "演示内容",
    "identity_check_kind": "REAL_NAME"
  },
  "BusinessConfigValue": {
    "schema_version": 1,
    "rules": [
      {
        "business_mode": "C2C",
        "supply_type": "PERSONAL",
        "rental_mode": "HOUR",
        "identity_required": false,
        "contract_required": false,
        "allowed_delivery_methods": [
          "EXPRESS"
        ],
        "payment_deadline_seconds": 1,
        "approval_deadline_seconds": 1
      }
    ]
  },
  "CatalogReason": {
    "reason": "演示内容"
  },
  "CatalogBrand": {
    "brand_id": "demo-brand",
    "name": "演示资料",
    "status": "ACTIVE",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z"
  },
  "CatalogBrandView": {
    "brand_id": "demo-brand",
    "name": "演示资料",
    "status": "ACTIVE",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "allowed_actions": [],
    "blocked_reasons": []
  },
  "CatalogBrandInput": {
    "name": "演示资料"
  },
  "CatalogBrandPatch": {
    "name": "演示资料",
    "reason": "演示内容"
  },
  "CatalogBrandPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "CatalogCategory": {
    "category_id": "demo-category",
    "name": "演示资料",
    "status": "ACTIVE",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "parent_id": "demo-parent",
    "sort_order": 0
  },
  "CatalogCategoryView": {
    "category_id": "demo-category",
    "name": "演示资料",
    "status": "ACTIVE",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "parent_id": "demo-parent",
    "sort_order": 0,
    "allowed_actions": [],
    "blocked_reasons": []
  },
  "CatalogCategoryInput": {
    "name": "演示资料",
    "parent_id": "demo-parent",
    "sort_order": 0
  },
  "CatalogCategoryPatch": {
    "name": "演示资料",
    "parent_id": "demo-parent",
    "sort_order": 0,
    "reason": "演示内容"
  },
  "CatalogCategoryPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "SMSDelivery": {
    "message_id": "demo-message",
    "recipient_masked": "1",
    "scene": "OPS_LOGIN",
    "template_key": "演示内容",
    "status": "PENDING",
    "created_at": "2026-10-14T06:00:00Z",
    "expires_at": "2026-10-14T06:00:00Z"
  },
  "SMSDeliveryPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "BuildInfo": {
    "version": "1",
    "revision": "演示内容",
    "build_time": "2026-10-14T06:00:00Z"
  },
  "HealthResponse": {
    "status": "ok",
    "build": {
      "version": "1",
      "revision": "演示内容",
      "build_time": "2026-10-14T06:00:00Z"
    },
    "time": "2026-10-14T06:00:00Z"
  },
  "ReadyResponse": {
    "status": "ready"
  },
  "ConfigKey": "material.upload_policy",
  "ConfigStatus": "DRAFT",
  "IdentityProfilePolicy": {
    "display_name_min_length": 1,
    "display_name_max_length": 1,
    "allowed_locales": [
      "演示内容"
    ],
    "avatar_material_class": "PROFILE_IMAGE",
    "avatar_required_status": "READY"
  },
  "SMSChallengePolicy": {
    "allowed_scenes": [
      "OPS_LOGIN"
    ],
    "digits": 6,
    "ttl_seconds": 60,
    "cooldown_seconds": 30,
    "max_attempts": 3,
    "phone_daily_limit": 1,
    "ip_daily_limit": 1
  },
  "TypedConfigValue": {
    "schema_version": 2,
    "return_instructions": "演示内容",
    "pickup_instructions": "演示内容",
    "grace_seconds": 0,
    "personal_rent_basis_points": 0,
    "loss_beneficiary_basis_points": 0,
    "evidence_templates": [
      {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容"
            }
          }
        ]
      }
    ],
    "template_bindings": [
      {
        "supply_channel": "PERSONAL",
        "fulfillment": "EXPRESS",
        "category_id": "demo-category",
        "template_key": "演示内容"
      }
    ]
  },
  "ConfigDefinition": {
    "config_key": "material.upload_policy",
    "schema_version": 1,
    "value_type": "MATERIAL_UPLOAD_POLICY",
    "scope_type": "GLOBAL",
    "status": "ACTIVE",
    "description_code": "演示内容",
    "updated_at": "2026-10-14T06:00:00Z"
  },
  "ConfigVersion": {
    "publication_mode": "APPROVAL",
    "config_version_id": "1",
    "config_key": "material.upload_policy",
    "version_no": 1,
    "schema_version": 1,
    "value": {
      "schema_version": 2,
      "return_instructions": "演示内容",
      "pickup_instructions": "演示内容",
      "grace_seconds": 0,
      "personal_rent_basis_points": 0,
      "loss_beneficiary_basis_points": 0,
      "evidence_templates": [
        {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容"
              }
            }
          ]
        }
      ],
      "template_bindings": [
        {
          "supply_channel": "PERSONAL",
          "fulfillment": "EXPRESS",
          "category_id": "demo-category",
          "template_key": "演示内容"
        }
      ]
    },
    "content_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "status": "DRAFT",
    "created_by": "演示内容",
    "validated_by": "演示内容",
    "approved_by": "演示内容",
    "published_by": "演示内容",
    "reason": "演示内容",
    "version": 1,
    "created_at": "2026-10-14T06:00:00Z",
    "validated_at": "2026-10-14T06:00:00Z",
    "approved_at": "2026-10-14T06:00:00Z",
    "published_at": "2026-10-14T06:00:00Z"
  },
  "EffectiveConfig": {
    "config_key": "material.upload_policy",
    "source": "DEFAULT_CODE",
    "schema_version": 1,
    "value": {
      "schema_version": 2,
      "return_instructions": "演示内容",
      "pickup_instructions": "演示内容",
      "grace_seconds": 0,
      "personal_rent_basis_points": 0,
      "loss_beneficiary_basis_points": 0,
      "evidence_templates": [
        {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容"
              }
            }
          ]
        }
      ],
      "template_bindings": [
        {
          "supply_channel": "PERSONAL",
          "fulfillment": "EXPRESS",
          "category_id": "demo-category",
          "template_key": "演示内容"
        }
      ]
    },
    "config_version": {
      "publication_mode": "APPROVAL",
      "config_version_id": "1",
      "config_key": "material.upload_policy",
      "version_no": 1,
      "schema_version": 1,
      "value": {
        "schema_version": 2,
        "return_instructions": "演示内容",
        "pickup_instructions": "演示内容",
        "grace_seconds": 0,
        "personal_rent_basis_points": 0,
        "loss_beneficiary_basis_points": 0,
        "evidence_templates": [
          {
            "template_key": "演示内容",
            "version": "1",
            "title": "演示资料",
            "slots": [
              {
                "slot_key": "演示内容",
                "title": "演示资料",
                "kind": "PHOTO",
                "stage": "PRE_RETURN",
                "min_count": 1,
                "max_count": 1,
                "instruction": "演示内容",
                "sort_order": 0,
                "example": {
                  "object_key": "演示内容",
                  "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  "mime_type": "image/jpeg",
                  "poster_object_key": "演示内容"
                }
              }
            ]
          }
        ],
        "template_bindings": [
          {
            "supply_channel": "PERSONAL",
            "fulfillment": "EXPRESS",
            "category_id": "demo-category",
            "template_key": "演示内容"
          }
        ]
      },
      "content_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "status": "DRAFT",
      "created_by": "演示内容",
      "validated_by": "演示内容",
      "approved_by": "演示内容",
      "published_by": "演示内容",
      "reason": "演示内容",
      "version": 1,
      "created_at": "2026-10-14T06:00:00Z",
      "validated_at": "2026-10-14T06:00:00Z",
      "approved_at": "2026-10-14T06:00:00Z",
      "published_at": "2026-10-14T06:00:00Z"
    },
    "effective_epoch": 1,
    "published_by": "演示内容",
    "published_at": "2026-10-14T06:00:00Z"
  },
  "DefinitionList": {
    "items": []
  },
  "EffectiveList": {
    "items": []
  },
  "VersionPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "CreateConfigVersionRequest": {
    "schema_version": 1,
    "config_key": "material.upload_policy",
    "value": {
      "schema_version": 2,
      "return_instructions": "演示内容",
      "pickup_instructions": "演示内容",
      "grace_seconds": 0,
      "personal_rent_basis_points": 0,
      "loss_beneficiary_basis_points": 0,
      "evidence_templates": [
        {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容"
              }
            }
          ]
        }
      ],
      "template_bindings": [
        {
          "supply_channel": "PERSONAL",
          "fulfillment": "EXPRESS",
          "category_id": "demo-category",
          "template_key": "演示内容"
        }
      ]
    },
    "reason": "演示内容"
  },
  "TransitionConfigVersionRequest": {
    "reason": "演示内容"
  },
  "EmptyObject": {},
  "MaterialClass": "PROFILE_IMAGE",
  "MaterialScopeType": "ACCOUNT",
  "MaterialStatus": "PENDING_UPLOAD",
  "Material": {
    "material_id": "demo-material",
    "owner_account_id": "demo-owner_account",
    "scope_type": "ACCOUNT",
    "scope_id": "demo-scope",
    "material_class": "PROFILE_IMAGE",
    "status": "PENDING_UPLOAD",
    "public_url": "演示内容",
    "playback_url": "演示内容",
    "metadata": {
      "schema_version": 1,
      "width": 1,
      "height": 1,
      "duration_ms": 1,
      "video_codec": "演示内容",
      "audio_codec": "演示内容"
    },
    "poster": {
      "material_id": "demo-material",
      "url": "演示内容",
      "width": 1,
      "height": 1
    },
    "mime_type": "演示内容",
    "size_bytes": 1,
    "object_version_id": "1",
    "object_etag": "演示内容",
    "expected_mime": "演示内容",
    "expected_size": 1,
    "expected_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "detected_mime": "演示内容",
    "observed_size": 0,
    "observed_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "sse_mode": "SSE-OSS",
    "scanner_verdict": "PASS",
    "rejection_reason": "演示内容",
    "authorization_expires_at": "2026-10-14T06:00:00Z",
    "version": 1,
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z"
  },
  "MaterialPhoto": {
    "material_id": "demo-material",
    "url": "演示内容",
    "sort_order": 0
  },
  "DiscoveryMedia": {
    "material_id": "demo-material",
    "role": "COVER",
    "sort_order": 0,
    "url": "演示内容",
    "mime_type": "演示内容",
    "size_bytes": 1,
    "metadata": {
      "schema_version": 1,
      "width": 1,
      "height": 1,
      "duration_ms": 1,
      "video_codec": "演示内容",
      "audio_codec": "演示内容"
    },
    "poster": {
      "material_id": "demo-material",
      "url": "演示内容",
      "width": 1,
      "height": 1
    }
  },
  "DiscoveryRegion": {
    "city_id": "demo-city",
    "city_name": "演示内容",
    "district_id": "demo-district",
    "district_name": "演示内容"
  },
  "DiscoveryCategory": {
    "category_id": "demo-category",
    "name": "演示资料"
  },
  "DiscoverySupply": {
    "asset_id": "demo-asset",
    "display_name": "演示资料",
    "category": {
      "category_id": "demo-category",
      "name": "演示资料"
    },
    "supply_type": "PERSONAL",
    "rental_mode": "DAY",
    "currency": "CNY",
    "unit_price_fen": "1",
    "deposit_fen": "1",
    "condition": "演示内容",
    "description": "演示内容",
    "availability_status": "AVAILABLE",
    "region": {
      "city_id": "demo-city",
      "city_name": "演示内容",
      "district_id": "demo-district",
      "district_name": "演示内容"
    },
    "media": []
  },
  "DiscoverySupplyPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    },
    "facets": {
      "categories": []
    },
    "filters": {
      "city_id": "demo-city",
      "category_id": "demo-category",
      "supply_type": "演示内容",
      "query": "演示内容"
    }
  },
  "DiscoveryStoreSummary": {
    "store_id": "demo-store",
    "name": "演示资料",
    "region": {
      "city_id": "demo-city",
      "city_name": "演示内容",
      "district_id": "demo-district",
      "district_name": "演示内容"
    },
    "status": "ACTIVE",
    "cover": {
      "material_id": "demo-material",
      "role": "COVER",
      "sort_order": 0,
      "url": "演示内容",
      "mime_type": "演示内容",
      "size_bytes": 1,
      "metadata": {
        "schema_version": 1,
        "width": 1,
        "height": 1,
        "duration_ms": 1,
        "video_codec": "演示内容",
        "audio_codec": "演示内容"
      },
      "poster": {
        "material_id": "demo-material",
        "url": "演示内容",
        "width": 1,
        "height": 1
      }
    }
  },
  "DiscoveryStore": {
    "store_id": "demo-store",
    "name": "演示资料",
    "region": {
      "city_id": "demo-city",
      "city_name": "演示内容",
      "district_id": "demo-district",
      "district_name": "演示内容"
    },
    "status": "ACTIVE",
    "cover": {
      "material_id": "demo-material",
      "role": "COVER",
      "sort_order": 0,
      "url": "演示内容",
      "mime_type": "演示内容",
      "size_bytes": 1,
      "metadata": {
        "schema_version": 1,
        "width": 1,
        "height": 1,
        "duration_ms": 1,
        "video_codec": "演示内容",
        "audio_codec": "演示内容"
      },
      "poster": {
        "material_id": "demo-material",
        "url": "演示内容",
        "width": 1,
        "height": 1
      }
    },
    "business_hours": {
      "timezone": "Asia/Shanghai",
      "week": [
        {
          "day": 1,
          "closed": false,
          "intervals": []
        },
        {
          "day": 1,
          "closed": false,
          "intervals": []
        }
      ]
    },
    "public_address": "演示内容",
    "public_phone": "演示内容",
    "supplies": [],
    "media": []
  },
  "DiscoveryStorePage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    },
    "filters": {
      "city_id": "demo-city"
    }
  },
  "Audience": "MINIPROGRAM",
  "ScopeGrant": {
    "type": "PLATFORM",
    "id": "演示内容"
  },
  "AccountView": {
    "display_name": "演示资料",
    "wechat_binding": {
      "status": "BOUND",
      "nickname": "演示内容",
      "avatar_material_id": null,
      "bound_at": null
    },
    "account_id": "demo-account",
    "audience": "MINIPROGRAM",
    "roles": [],
    "permissions": [],
    "scopes": []
  },
  "AccountProfile": {
    "account_id": "demo-account",
    "display_name": "演示资料",
    "avatar_material_id": "demo-avatar_material",
    "locale": "zh-CN",
    "version": 1,
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z"
  },
  "UpdateAccountProfileRequest": {
    "display_name": "演示资料",
    "avatar_material_id": "demo-avatar_material",
    "locale": "zh-CN"
  },
  "AccountDirectoryEntry": {
    "phone_masked": "1",
    "last_login_at": null,
    "archived_at": null,
    "archived_by": "演示内容",
    "wechat_binding": {
      "status": "BOUND",
      "nickname": "演示内容",
      "avatar_material_id": null,
      "bound_at": null
    },
    "account_id": "demo-account",
    "status": "ACTIVE",
    "security_version": 1,
    "display_name": "演示资料",
    "roles": [],
    "scopes": [],
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z"
  },
  "MiniLoginRequest": {
    "code": "演示内容"
  },
  "MiniPhoneLoginRequest": {
    "phone_code": "演示内容",
    "code": "演示内容"
  },
  "MiniPhoneBindingRequest": {
    "phone_code": "演示内容"
  },
  "MiniWechatBindingRequest": {
    "code": "演示内容"
  },
  "OwnAuthenticatorAction": {
    "code": "BIND_PHONE",
    "enabled": false,
    "blocked_reason": "演示内容"
  },
  "OwnAuthenticators": {
    "account_id": "demo-account",
    "security_version": 1,
    "phone_bound": false,
    "phone_masked": "1",
    "wechat_bound": false,
    "allowed_actions": []
  },
  "IdentityKindStatus": {
    "status": "NOT_VERIFIED",
    "verification_id": "demo-verification",
    "can_create_verification": false,
    "verified_at": "2026-10-14T06:00:00Z",
    "valid_until": "2026-10-14T06:00:00Z"
  },
  "OwnIdentityStatus": {
    "overall_status": "NOT_VERIFIED",
    "real_name": {
      "status": "NOT_VERIFIED",
      "verification_id": "demo-verification",
      "can_create_verification": false,
      "verified_at": "2026-10-14T06:00:00Z",
      "valid_until": "2026-10-14T06:00:00Z"
    },
    "face": {
      "status": "NOT_VERIFIED",
      "verification_id": "demo-verification",
      "can_create_verification": false,
      "verified_at": "2026-10-14T06:00:00Z",
      "valid_until": "2026-10-14T06:00:00Z"
    }
  },
  "RefreshRequest": {
    "refresh_token": "演示内容"
  },
  "SessionResponse": {
    "access_token": "演示内容",
    "refresh_token": "演示内容",
    "token_type": "Bearer",
    "expires_in": 1,
    "account": {
      "display_name": "演示资料",
      "wechat_binding": {
        "status": "BOUND",
        "nickname": "演示内容",
        "avatar_material_id": null,
        "bound_at": null
      },
      "account_id": "demo-account",
      "audience": "MINIPROGRAM",
      "roles": [],
      "permissions": [],
      "scopes": []
    }
  },
  "PhoneChallengeRequest": {
    "phone": "演示内容"
  },
  "ChallengeSessionRequest": {
    "challenge_id": "demo-challenge",
    "proof": "演示内容"
  },
  "ChallengeResponse": {
    "challenge_id": "demo-challenge",
    "status": "PENDING",
    "expires_in": 1,
    "retry_after_seconds": 0
  },
  "Role": {
    "role_id": "demo-role",
    "role_code": "演示内容",
    "status": "ACTIVE",
    "version": 1,
    "permissions": []
  },
  "ReplaceRolePermissionsRequest": {
    "permissions": [],
    "reason": "演示内容"
  },
  "ReplaceAccountAuthorizationRequest": {
    "role_ids": [],
    "scopes": [],
    "reason": "演示内容"
  },
  "AccountAuthorization": {
    "account_id": "demo-account",
    "role_ids": [],
    "scopes": [],
    "version": 1
  },
  "SecurityPolicy": {
    "access_ttl_seconds": 300,
    "mini_refresh_idle_seconds": 86400,
    "mini_refresh_absolute_seconds": 86401,
    "ops_refresh_idle_seconds": 900,
    "ops_refresh_absolute_seconds": 901,
    "challenge_ttl_seconds": 180,
    "challenge_max_attempts": 3,
    "login_rate_limit": 1,
    "refresh_rate_limit": 1,
    "max_sessions_per_audience": 1
  },
  "SecurityPolicyVersion": {
    "policy_version_id": "1",
    "version": 1,
    "status": "DRAFT",
    "policy": {
      "access_ttl_seconds": 300,
      "mini_refresh_idle_seconds": 86400,
      "mini_refresh_absolute_seconds": 86401,
      "ops_refresh_idle_seconds": 900,
      "ops_refresh_absolute_seconds": 901,
      "challenge_ttl_seconds": 180,
      "challenge_max_attempts": 3,
      "login_rate_limit": 1,
      "refresh_rate_limit": 1,
      "max_sessions_per_audience": 1
    },
    "content_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "created_by": "演示内容",
    "approved_by": "演示内容",
    "published_by": "演示内容",
    "created_at": "2026-10-14T06:00:00Z"
  },
  "CreateSecurityPolicyRequest": {
    "policy": {
      "access_ttl_seconds": 300,
      "mini_refresh_idle_seconds": 86400,
      "mini_refresh_absolute_seconds": 86401,
      "ops_refresh_idle_seconds": 900,
      "ops_refresh_absolute_seconds": 901,
      "challenge_ttl_seconds": 180,
      "challenge_max_attempts": 3,
      "login_rate_limit": 1,
      "refresh_rate_limit": 1,
      "max_sessions_per_audience": 1
    },
    "reason": "演示内容"
  },
  "TransitionSecurityPolicyRequest": {
    "reason": "演示内容"
  },
  "LoginEvent": {
    "current_display_name": "演示内容",
    "current_roles": [],
    "event_id": "demo-event",
    "event_type": "演示内容",
    "result_code": "演示内容",
    "account_id": "demo-account",
    "session_id": "demo-session",
    "audience": "MINIPROGRAM",
    "login_method": "演示内容",
    "provider_code": "演示内容",
    "request_id": "demo-request",
    "occurred_at": "2026-10-14T06:00:00Z"
  },
  "OperationEvent": {
    "current_display_name": "演示内容",
    "event_id": "demo-event",
    "actor_account_id": "demo-actor_account",
    "session_id": "demo-session",
    "permission_code": "演示内容",
    "operation_id": "demo-operation",
    "resource_type": "演示内容",
    "resource_id": "demo-resource",
    "action_code": "演示内容",
    "result_code": "演示内容",
    "http_status": 100,
    "request_id": "demo-request",
    "reason_summary": "演示内容",
    "field_change_summary": {
      "role_code_changed": false,
      "permission_count": 0,
      "role_count": 0,
      "scope_count": 0,
      "policy_created": false,
      "status_from": "2026-10-14T06:00:00Z",
      "status_to": "演示内容",
      "page_size": 1,
      "search_filter_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "login_method": "演示内容",
      "action_code": "演示内容",
      "result_class": "SUCCESS",
      "source": "CONTROLLED_INITIALIZATION",
      "environment_code": "演示内容",
      "authorization_ref": "演示内容",
      "permission_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "action": "演示内容",
      "display_name_changed": false,
      "avatar_changed": false,
      "locale_changed": false
    },
    "occurred_at": "2026-10-14T06:00:00Z"
  },
  "MaterialFileResult": {
    "metadata": {
      "schema_version": 1,
      "width": 1,
      "height": 1,
      "duration_ms": 1,
      "video_codec": "演示内容",
      "audio_codec": "演示内容"
    },
    "poster": {
      "material_id": "demo-material",
      "url": "演示内容",
      "width": 1,
      "height": 1
    },
    "material_id": "demo-material",
    "upload_id": "demo-upload",
    "status": "UPLOADED",
    "public_url": "演示内容",
    "playback_url": "演示内容",
    "mime_type": "演示内容",
    "size_bytes": 1
  },
  "OwnCatalogCategory": {
    "category_id": "demo-category",
    "name": "演示资料"
  },
  "OwnCatalogCategoryList": {
    "items": []
  },
  "OwnCatalogMedia": {
    "material_id": "demo-material",
    "role": "COVER",
    "sort_order": 0,
    "url": "演示内容",
    "mime_type": "演示内容",
    "size_bytes": 1,
    "metadata": {
      "schema_version": 1,
      "width": 1,
      "height": 1,
      "duration_ms": 1,
      "video_codec": "演示内容",
      "audio_codec": "演示内容"
    },
    "poster": {
      "material_id": "demo-material",
      "url": "演示内容",
      "width": 1,
      "height": 1
    }
  },
  "OwnCatalogProduct": {
    "product_id": "demo-product",
    "name": "演示资料",
    "model": "演示内容",
    "description": "演示内容",
    "brand_id": "demo-brand",
    "brand_name": "演示内容",
    "category_id": "demo-category",
    "category_name": "演示内容",
    "tags": [],
    "media": [],
    "updated_at": "2026-10-14T06:00:00Z"
  },
  "OwnCatalogProductPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "Merchant": {
    "merchant_id": "demo-merchant",
    "name": "演示资料",
    "contact_name": "演示内容",
    "phone_dial": "1",
    "responsible_lessor_id": "demo-responsible_lessor",
    "status": "ACTIVE",
    "archive_reason": "演示内容",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "business_profile": {
      "address": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "detail_address": "演示内容",
        "contact_name": "演示内容",
        "phone_dial": "1",
        "location": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02",
          "source": "MAP_PICK"
        }
      },
      "poi_name": "演示内容",
      "share_basis_points": 0,
      "settlement_cycle": "MONTHLY",
      "settlement_account": "演示内容",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容",
      "business_hours": {
        "timezone": "Asia/Shanghai",
        "week": [
          {
            "day": 1,
            "closed": false,
            "intervals": []
          },
          {
            "day": 1,
            "closed": false,
            "intervals": []
          }
        ]
      },
      "store_id": "demo-store"
    },
    "photo_material_ids": [],
    "cover_material_id": "demo-cover_material",
    "photos": [],
    "cover": {
      "material_id": "demo-material",
      "url": "演示内容",
      "sort_order": 0
    }
  },
  "MerchantInput": {
    "name": "演示资料",
    "contact_name": "演示内容",
    "phone_dial": "1",
    "business_profile": {
      "address": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "detail_address": "演示内容",
        "contact_name": "演示内容",
        "phone_dial": "1",
        "location": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02",
          "source": "MAP_PICK"
        }
      },
      "poi_name": "演示内容",
      "share_basis_points": 0,
      "settlement_cycle": "MONTHLY",
      "settlement_account": "演示内容",
      "business_hours": {
        "timezone": "Asia/Shanghai",
        "week": [
          {
            "day": 1,
            "closed": false,
            "intervals": []
          },
          {
            "day": 1,
            "closed": false,
            "intervals": []
          }
        ]
      }
    },
    "photo_material_ids": []
  },
  "MerchantPatch": "演示内容",
  "MerchantAction": {
    "code": "UPDATE",
    "enabled": false,
    "blocked_reasons": []
  },
  "MerchantView": {
    "merchant_id": "demo-merchant",
    "name": "演示资料",
    "contact_name": "演示内容",
    "phone_dial": "1",
    "responsible_lessor_id": "demo-responsible_lessor",
    "status": "ACTIVE",
    "archive_reason": "演示内容",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "allowed_actions": [],
    "blocked_reasons": [],
    "business_profile": {
      "address": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "detail_address": "演示内容",
        "contact_name": "演示内容",
        "phone_dial": "1",
        "location": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02",
          "source": "MAP_PICK"
        }
      },
      "poi_name": "演示内容",
      "share_basis_points": 0,
      "settlement_cycle": "MONTHLY",
      "settlement_account": "演示内容",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容",
      "business_hours": {
        "timezone": "Asia/Shanghai",
        "week": [
          {
            "day": 1,
            "closed": false,
            "intervals": []
          },
          {
            "day": 1,
            "closed": false,
            "intervals": []
          }
        ]
      },
      "store_id": "demo-store"
    },
    "cabinet_count": "1"
  },
  "MerchantPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "MerchantReason": {
    "reason": "演示内容"
  },
  "PlatformLessor": {
    "lessor_id": "demo-lessor",
    "display_name": "演示资料",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z"
  },
  "PlatformLessorPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "MerchantBusinessProfileInput": {
    "address": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "detail_address": "演示内容",
      "contact_name": "演示内容",
      "phone_dial": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    },
    "poi_name": "演示内容",
    "share_basis_points": 0,
    "settlement_cycle": "MONTHLY",
    "settlement_account": "演示内容",
    "business_hours": {
      "timezone": "Asia/Shanghai",
      "week": [
        {
          "day": 1,
          "closed": false,
          "intervals": []
        },
        {
          "day": 1,
          "closed": false,
          "intervals": []
        }
      ]
    }
  },
  "MerchantBusinessProfile": {
    "address": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "detail_address": "演示内容",
      "contact_name": "演示内容",
      "phone_dial": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    },
    "poi_name": "演示内容",
    "share_basis_points": 0,
    "settlement_cycle": "MONTHLY",
    "settlement_account": "演示内容",
    "province_name": "演示内容",
    "city_name": "演示内容",
    "district_name": "演示内容",
    "business_hours": {
      "timezone": "Asia/Shanghai",
      "week": [
        {
          "day": 1,
          "closed": false,
          "intervals": []
        },
        {
          "day": 1,
          "closed": false,
          "intervals": []
        }
      ]
    },
    "store_id": "demo-store"
  },
  "MerchantPhoto": {
    "material_id": "demo-material",
    "url": "演示内容",
    "sort_order": 0
  },
  "OpsCabinetCredential": {
    "credential_id": "demo-credential",
    "kind": "PICKUP",
    "cabinet_id": "demo-cabinet",
    "compartment_id": "demo-compartment",
    "placement_id": "demo-placement",
    "status": "DORMANT",
    "generated_at": "2026-10-14T06:00:00Z",
    "activated_at": "2026-10-14T06:00:00Z",
    "consumed_at": "2026-10-14T06:00:00Z",
    "revoked_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": "1"
  },
  "OpsCabinetCredentialReplaceRequest": {
    "reason": "演示内容"
  },
  "OpsCabinetCredentialReplaceReceipt": {
    "previous": {
      "credential_id": "demo-credential",
      "kind": "PICKUP",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "placement_id": "demo-placement",
      "status": "DORMANT",
      "generated_at": "2026-10-14T06:00:00Z",
      "activated_at": "2026-10-14T06:00:00Z",
      "consumed_at": "2026-10-14T06:00:00Z",
      "revoked_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z",
      "version": "1"
    },
    "replacement": {
      "credential_id": "demo-credential",
      "kind": "PICKUP",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "placement_id": "demo-placement",
      "status": "DORMANT",
      "generated_at": "2026-10-14T06:00:00Z",
      "activated_at": "2026-10-14T06:00:00Z",
      "consumed_at": "2026-10-14T06:00:00Z",
      "revoked_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z",
      "version": "1"
    },
    "event_id": "demo-event",
    "occurred_at": "2026-10-14T06:00:00Z",
    "replayed": false
  },
  "OpsDashboardSummary": {
    "as_of_at": "2026-10-14T06:00:00Z",
    "merchant_count": "1",
    "operating_store_count": "1",
    "cabinet_total": "1",
    "cabinet_online": "1",
    "cabinet_offline": "1",
    "cabinet_unknown": "1",
    "box_total": "1",
    "box_available": "1",
    "box_reserved": "1",
    "box_occupied": "1",
    "box_unavailable": "1",
    "asset_total": "1",
    "asset_in_cabinet": "1"
  },
  "OpsFinanceQueryRequest": {
    "reason": "演示内容"
  },
  "OpsFinanceQueryReceipt": {
    "command_id": "demo-command",
    "resource_type": "PAYOUT",
    "resource_id": "demo-resource",
    "status": "ACCEPTED",
    "accepted_at": "2026-10-14T06:00:00Z",
    "replayed": false
  },
  "OpsCashJournalSource": {
    "type": "WITHDRAWAL",
    "id": "演示内容"
  },
  "OpsFinanceQueryState": {
    "status": "NOT_CREATED",
    "attempt_count": 0,
    "max_attempts": 0,
    "available_at": "2026-10-14T06:00:00Z",
    "lease_expires_at": "2026-10-14T06:00:00Z",
    "last_error_code": "演示内容"
  },
  "OpsFinanceBlockedReason": {
    "code": "演示内容",
    "message": "演示内容",
    "field": "演示内容"
  },
  "OpsFinanceActionState": {
    "code": "DECIDE_OPS_WITHDRAWAL",
    "enabled": false,
    "blocked_reasons": []
  },
  "OpsCashAccountSummary": {
    "cash_account_id": "demo-cash_account",
    "owner_kind": "USER",
    "owner_account_id": "demo-owner_account",
    "system_owner_code": "演示内容",
    "account_kind": "USER_WALLET_AVAILABLE"
  },
  "OpsCashEntry": {
    "entry_id": "demo-entry",
    "journal_id": "demo-journal",
    "entry_no": "1",
    "account": {
      "cash_account_id": "demo-cash_account",
      "owner_kind": "USER",
      "owner_account_id": "demo-owner_account",
      "system_owner_code": "演示内容",
      "account_kind": "USER_WALLET_AVAILABLE"
    },
    "source": {
      "type": "WITHDRAWAL",
      "id": "演示内容"
    },
    "currency": "CNY",
    "debit_fen": "1",
    "credit_fen": "1",
    "posted_at": "2026-10-14T06:00:00Z",
    "created_at": "2026-10-14T06:00:00Z"
  },
  "OpsCashPostingAggregate": {
    "count": "1",
    "debit_fen": "1",
    "credit_fen": "1"
  },
  "OpsFinanceSummary": {
    "from": "2026-10-14T06:00:00Z",
    "to": "2026-10-14T06:00:00Z",
    "as_of_at": "2026-10-14T06:00:00Z",
    "currency": "CNY",
    "cash_entries": {
      "count": "1",
      "debit_fen": "1",
      "credit_fen": "1"
    }
  },
  "OpsWithdrawal": {
    "withdrawal_id": "demo-withdrawal",
    "account_id": "demo-account",
    "amount_fen": "1",
    "currency": "CNY",
    "provider": "WECHAT",
    "payee_identity_masked": "演示内容",
    "provider_config_version_id": "1",
    "status": "PENDING_REVIEW",
    "frozen_journal_id": "demo-frozen_journal",
    "payout_id": "demo-payout",
    "reviewed_by": "演示内容",
    "reviewed_at": "2026-10-14T06:00:00Z",
    "review_reason": "演示内容",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": []
  },
  "OpsPayout": {
    "payout_id": "demo-payout",
    "source_withdrawal_id": "demo-source_withdrawal",
    "account_id": "demo-account",
    "provider": "WECHAT",
    "provider_account_masked": "演示内容",
    "request_number_masked": "演示内容",
    "amount_fen": "1",
    "currency": "CNY",
    "payee_identity_masked": "演示内容",
    "status": "READY",
    "provider_transfer_id_masked": "演示内容",
    "success_at": "2026-10-14T06:00:00Z",
    "last_observed_at": "2026-10-14T06:00:00Z",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "query": {
      "status": "NOT_CREATED",
      "attempt_count": 0,
      "max_attempts": 0,
      "available_at": "2026-10-14T06:00:00Z",
      "lease_expires_at": "2026-10-14T06:00:00Z",
      "last_error_code": "演示内容"
    },
    "allowed_actions": []
  },
  "OpsReconciliationBatch": {
    "batch_id": "demo-batch",
    "provider": "WECHAT",
    "merchant_id_masked": "演示内容",
    "business_date": "1",
    "bill_material_id": "demo-bill_material",
    "status": "IMPORTING",
    "item_count": "1",
    "open_item_count": "1",
    "resolved_item_count": "1",
    "ignored_item_count": "1",
    "difference_abs_fen": "1",
    "currency": "CNY",
    "started_at": "2026-10-14T06:00:00Z",
    "completed_at": "2026-10-14T06:00:00Z",
    "error_code": "演示内容",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": "1"
  },
  "OpsReconciliationCreateRequest": {
    "provider": "WECHAT",
    "business_date": "1",
    "bill_material_id": "demo-bill_material",
    "provider_config_version_id": "1"
  },
  "OpsReconciliationReceipt": {
    "batch": {
      "batch_id": "demo-batch",
      "provider": "WECHAT",
      "merchant_id_masked": "演示内容",
      "business_date": "1",
      "bill_material_id": "demo-bill_material",
      "status": "IMPORTING",
      "item_count": "1",
      "open_item_count": "1",
      "resolved_item_count": "1",
      "ignored_item_count": "1",
      "difference_abs_fen": "1",
      "currency": "CNY",
      "started_at": "2026-10-14T06:00:00Z",
      "completed_at": "2026-10-14T06:00:00Z",
      "error_code": "演示内容",
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z",
      "version": "1"
    },
    "replayed": false
  },
  "OpsReconciliationResolutionRequest": {
    "resolution_kind": "REQUERY_ORIGIN",
    "reason": "演示内容"
  },
  "OpsReconciliationResolutionReceipt": {
    "item_id": "demo-item",
    "batch_id": "demo-batch",
    "status": "RESOLVED",
    "resolution_kind": "REQUERY_ORIGIN",
    "resolution_ref": "演示内容",
    "query_job_id": "1",
    "journal_id": "demo-journal",
    "resolved_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "replayed": false
  },
  "CashBalance": {
    "currency": "CNY",
    "available_fen": "1",
    "frozen_fen": "1",
    "withdrawable_fen": "1",
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "WithdrawalProjection": {
    "withdrawal_id": "demo-withdrawal",
    "amount_fen": "1",
    "currency": "CNY",
    "provider": "WECHAT",
    "provider_config_version_id": "1",
    "status": "PENDING_REVIEW",
    "frozen_journal_id": "demo-frozen_journal",
    "payout_id": "demo-payout",
    "reviewed_at": "2026-10-14T06:00:00Z",
    "review_reason": "演示内容",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": "1"
  },
  "WithdrawalCreateRequest": {
    "amount_fen": "1",
    "provider_config_version_id": "1",
    "provider_confirmation_token": "演示内容"
  },
  "WithdrawalReceipt": {
    "withdrawal": {
      "withdrawal_id": "demo-withdrawal",
      "amount_fen": "1",
      "currency": "CNY",
      "provider": "WECHAT",
      "provider_config_version_id": "1",
      "status": "PENDING_REVIEW",
      "frozen_journal_id": "demo-frozen_journal",
      "payout_id": "demo-payout",
      "reviewed_at": "2026-10-14T06:00:00Z",
      "review_reason": "演示内容",
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z",
      "version": "1"
    },
    "balance": {
      "currency": "CNY",
      "available_fen": "1",
      "frozen_fen": "1",
      "withdrawable_fen": "1",
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "replayed": false
  },
  "WithdrawalDecisionRequest": {
    "decision": "APPROVE",
    "reason": "演示内容"
  },
  "WithdrawalDecisionReceipt": {
    "withdrawal": {
      "withdrawal_id": "demo-withdrawal",
      "amount_fen": "1",
      "currency": "CNY",
      "provider": "WECHAT",
      "provider_config_version_id": "1",
      "status": "PENDING_REVIEW",
      "frozen_journal_id": "demo-frozen_journal",
      "payout_id": "demo-payout",
      "reviewed_at": "2026-10-14T06:00:00Z",
      "review_reason": "演示内容",
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z",
      "version": "1"
    },
    "decision": "APPROVE",
    "payout_id": "demo-payout",
    "replayed": false
  },
  "OpsEntitlementPurchaseListItem": {
    "purchase_id": "demo-purchase",
    "purchase_no": "演示内容",
    "buyer_id": "demo-buyer",
    "offer_code": "演示内容",
    "kind": "CONTRACT",
    "quantity": "1",
    "cost_unit": "CNY",
    "purchase_model": "PINK_IMMEDIATE",
    "unit_price": "1",
    "gross_cost": "1",
    "discount_cost": "1",
    "total_cost": "1",
    "rule_version_id": "1",
    "consideration_status": "UNPAID",
    "grant_status": "NOT_GRANTED",
    "refund_status": "NONE",
    "settled_at": "2026-10-14T06:00:00Z",
    "granted_at": "2026-10-14T06:00:00Z",
    "closed_at": "2026-10-14T06:00:00Z",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": "1"
  },
  "OpsEntitlementLotSummary": {
    "lot_id": "demo-lot",
    "granted_quantity": "1",
    "available_quantity": "1",
    "reserved_quantity": "1",
    "consumed_quantity": "1",
    "refund_frozen_quantity": "1",
    "revoked_quantity": "1",
    "expired_quantity": "1",
    "valid_until": "2026-10-14T06:00:00Z",
    "version": "1"
  },
  "OpsEntitlementPurchaseDetail": {
    "purchase_id": "demo-purchase",
    "purchase_no": "演示内容",
    "buyer_id": "demo-buyer",
    "offer_code": "演示内容",
    "kind": "CONTRACT",
    "quantity": "1",
    "cost_unit": "CNY",
    "purchase_model": "PINK_IMMEDIATE",
    "unit_price": "1",
    "gross_cost": "1",
    "discount_cost": "1",
    "total_cost": "1",
    "rule_version_id": "1",
    "consideration_status": "UNPAID",
    "grant_status": "NOT_GRANTED",
    "refund_status": "NONE",
    "settled_at": "2026-10-14T06:00:00Z",
    "granted_at": "2026-10-14T06:00:00Z",
    "closed_at": "2026-10-14T06:00:00Z",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "lot": {
      "lot_id": "demo-lot",
      "granted_quantity": "1",
      "available_quantity": "1",
      "reserved_quantity": "1",
      "consumed_quantity": "1",
      "refund_frozen_quantity": "1",
      "revoked_quantity": "1",
      "expired_quantity": "1",
      "valid_until": "2026-10-14T06:00:00Z",
      "version": "1"
    },
    "point_ledger_entry_id": "demo-point_ledger_entry",
    "entitlement_movement_id": "demo-entitlement_movement",
    "allowed_actions": [],
    "name": "演示资料",
    "cny_price_fen": "1",
    "pink_price": "1",
    "items": [
      {
        "entitlement_movement_id": "demo-entitlement_movement",
        "lot": {
          "lot_id": "demo-lot",
          "granted_quantity": "1",
          "available_quantity": "1",
          "reserved_quantity": "1",
          "consumed_quantity": "1",
          "refund_frozen_quantity": "1",
          "revoked_quantity": "1",
          "expired_quantity": "1",
          "valid_until": "2026-10-14T06:00:00Z",
          "version": "1"
        },
        "kind": "CONTRACT",
        "valid_days": 1,
        "quantity": "1"
      }
    ]
  },
  "PhoneVerification": {
    "challenge_id": "demo-challenge",
    "status": "演示内容",
    "expires_at": "2026-10-14T06:00:00Z"
  },
  "OpsIAMAccount": {
    "account_id": "demo-account",
    "status": "ACTIVE",
    "security_version": 1,
    "display_name": "演示资料",
    "roles": [],
    "scopes": [],
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "phone_verification": {
      "challenge_id": "demo-challenge",
      "status": "演示内容",
      "expires_at": "2026-10-14T06:00:00Z"
    },
    "phone_masked": "1",
    "last_login_at": null,
    "archived_at": null,
    "archived_by": "演示内容",
    "wechat_binding": {
      "status": "BOUND",
      "nickname": "演示内容",
      "avatar_material_id": null,
      "bound_at": null
    }
  },
  "CreateOpsIAMAccountRequest": {
    "display_name": "演示资料",
    "phone": "演示内容",
    "role_ids": [
      "演示内容"
    ],
    "scopes": [],
    "reason": "演示内容",
    "status": "ACTIVE"
  },
  "ChangeOpsIAMAccountStatusRequest": {
    "reason": "演示内容"
  },
  "UpdateOpsIAMAccountRequest": {
    "display_name": "演示资料",
    "phone": "演示内容",
    "reason": "演示内容",
    "role_ids": [
      "演示内容"
    ]
  },
  "WechatSubscriptionObservationRequest": {
    "scene": "演示内容",
    "template_id": "demo-template",
    "client_result": "ACCEPT",
    "observed_at": "2026-10-14T06:00:00Z"
  },
  "WechatSubscriptionObservation": {
    "subscription_id": "demo-subscription",
    "scene": "演示内容",
    "template_id": "demo-template",
    "client_result": "ACCEPT",
    "observed_at": "2026-10-14T06:00:00Z",
    "status": "OBSERVED",
    "version": 1,
    "created_at": "2026-10-14T06:00:00Z"
  },
  "Challenge": {
    "challenge_id": "demo-challenge",
    "purpose": "LOGIN",
    "status": "PENDING",
    "expires_at": "2026-10-14T06:00:00Z",
    "display_name": "演示资料",
    "phone_masked": "1",
    "poll_token": "演示内容",
    "code_image": "演示内容"
  },
  "EmptyRequest": {},
  "InspectRequest": {
    "scan_token": "演示内容"
  },
  "DecisionRequest": {
    "scan_token": "演示内容",
    "approve": false
  },
  "Sequence": "1",
  "Hash": "演示内容",
  "URL": "演示内容",
  "Intent": "演示内容",
  "SignatureAttempt": {
    "attempt_id": "demo-attempt",
    "client_signature_id": "demo-client_signature",
    "status": "BUILDING",
    "version": "1",
    "preview_artifact_id": "demo-preview_artifact",
    "preview_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "error_code": "演示内容",
    "allowed_actions": [],
    "expires_at": "2026-10-14T06:00:00Z",
    "confirmed_at": "2026-10-14T06:00:00Z"
  },
  "SignatureAttemptLookup": {
    "state": "FOUND",
    "attempt": {
      "attempt_id": "demo-attempt",
      "client_signature_id": "demo-client_signature",
      "status": "BUILDING",
      "version": "1",
      "preview_artifact_id": "demo-preview_artifact",
      "preview_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "error_code": "演示内容",
      "allowed_actions": [],
      "expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z"
    },
    "signature_image": {
      "material_id": "demo-material",
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "url": "演示内容"
    }
  },
  "SignatureImage": {
    "material_id": "demo-material",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "url": "演示内容"
  },
  "SignatureCreate": {
    "client_signature_id": "demo-client_signature",
    "signature_material_id": "demo-signature_material",
    "agreement_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "order_terms_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "replaces_attempt_id": "demo-replaces_attempt",
    "replaces_attempt_version": "1"
  },
  "SignatureConfirm": {
    "preview_artifact_id": "demo-preview_artifact",
    "preview_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "accepted": true
  },
  "ArtifactPage": {
    "page_no": 1,
    "material_id": "demo-material",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "url": "演示内容"
  },
  "SignatureAnchor": {
    "role": "TENANT_MAIN",
    "page_no": 1,
    "x": 0,
    "y": 0,
    "w": 1,
    "h": 1
  },
  "ContractArtifact": {
    "artifact_id": "demo-artifact",
    "document_material_id": "demo-document_material",
    "document_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "document_url": "演示内容",
    "page_count": 1,
    "pages": [
      {
        "page_no": 1,
        "material_id": "demo-material",
        "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "url": "演示内容"
      }
    ],
    "anchor_snapshot_json": [
      {
        "role": "TENANT_MAIN",
        "page_no": 1,
        "x": 0,
        "y": 0,
        "w": 1,
        "h": 1
      }
    ],
    "renderer_version": "1"
  },
  "DocumentTemplate": {
    "template_version_id": "1",
    "source_docx_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "LessorSignature": {
    "name": "演示资料",
    "mode": "DEFAULT_SIGNED",
    "source": "USER_CONFIRMED_LOCAL_DEFAULT",
    "presignature_id": null,
    "material_id": null,
    "signed_at": null
  },
  "TenantSignature": {
    "name": "演示资料",
    "account_id": "demo-account",
    "status": "PENDING",
    "signed_at": "2026-10-14T06:00:00Z"
  },
  "MessageSummary": {
    "message_id": "demo-message",
    "kind": "TEXT",
    "preview": "演示内容",
    "sender_id": "demo-sender",
    "sent_at": "2026-10-14T06:00:00Z"
  },
  "OrderConversation": {
    "conversation_id": "demo-conversation",
    "context_kind": "ORDER",
    "order_id": "demo-order",
    "viewer_role": "TENANT",
    "peer": {
      "account_id": "demo-account",
      "display_name": "演示资料",
      "avatar_url": "演示内容",
      "role": "TENANT"
    },
    "order_summary": {
      "order_id": "demo-order",
      "order_no": "演示内容",
      "asset_title": "演示内容",
      "cover_url": "演示内容",
      "display_status_code": "演示内容",
      "rental_start_at": "2026-10-14T06:00:00Z",
      "rental_end_at": "2026-10-14T06:00:00Z"
    },
    "last_message": {
      "message_id": "demo-message",
      "kind": "TEXT",
      "preview": "演示内容",
      "sender_id": "demo-sender",
      "sent_at": "2026-10-14T06:00:00Z"
    },
    "last_message_at": "2026-10-14T06:00:00Z",
    "read_sequence": "1",
    "unread_count": "1",
    "can_post": false,
    "blocked_reason": "演示内容",
    "version": "1"
  },
  "OrderConversationPage": {
    "items": [],
    "next_cursor": "演示内容",
    "has_more": false,
    "total_unread_count": "1",
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "OrderMessage": {
    "message_id": "demo-message",
    "sequence": "1",
    "client_message_id": "demo-client_message",
    "sender_id": "demo-sender",
    "kind": "TEXT",
    "body": "演示内容",
    "media": {
      "material_id": "demo-material",
      "url": "演示内容",
      "mime_type": "image/png",
      "width": 1,
      "height": 1
    },
    "sent_at": "2026-10-14T06:00:00Z"
  },
  "OrderMessageCreate": {
    "client_message_id": "demo-client_message",
    "kind": "TEXT",
    "body": "演示内容",
    "material_id": "demo-material"
  },
  "OrderMessageLookup": {
    "state": "APPLIED",
    "message": {
      "message_id": "demo-message",
      "sequence": "1",
      "client_message_id": "demo-client_message",
      "sender_id": "demo-sender",
      "kind": "TEXT",
      "body": "演示内容",
      "media": {
        "material_id": "demo-material",
        "url": "演示内容",
        "mime_type": "image/png",
        "width": 1,
        "height": 1
      },
      "sent_at": "2026-10-14T06:00:00Z"
    }
  },
  "OrderMessagePage": {
    "conversation": {
      "conversation_id": "demo-conversation",
      "context_kind": "ORDER",
      "order_id": "demo-order",
      "viewer_role": "TENANT",
      "peer": {
        "account_id": "demo-account",
        "display_name": "演示资料",
        "avatar_url": "演示内容",
        "role": "TENANT"
      },
      "order_summary": {
        "order_id": "demo-order",
        "order_no": "演示内容",
        "asset_title": "演示内容",
        "cover_url": "演示内容",
        "display_status_code": "演示内容",
        "rental_start_at": "2026-10-14T06:00:00Z",
        "rental_end_at": "2026-10-14T06:00:00Z"
      },
      "last_message": {
        "message_id": "demo-message",
        "kind": "TEXT",
        "preview": "演示内容",
        "sender_id": "demo-sender",
        "sent_at": "2026-10-14T06:00:00Z"
      },
      "last_message_at": "2026-10-14T06:00:00Z",
      "read_sequence": "1",
      "unread_count": "1",
      "can_post": false,
      "blocked_reason": "演示内容",
      "version": "1"
    },
    "items": [],
    "has_more": false,
    "next_before_sequence": "1",
    "next_after_sequence": "1",
    "last_sequence": "1"
  },
  "OrderReadCursorRequest": {
    "through_sequence": "1"
  },
  "OrderReadCursor": {
    "read_sequence": "1",
    "unread_count": "1"
  },
  "OwnEntitlementOffer": {
    "offer_code": "演示内容",
    "kind": "CONTRACT",
    "cost_unit": "CNY",
    "unit_price": "1",
    "min_quantity": "1",
    "max_quantity": "1",
    "maximum_purchasable_quantity": "1",
    "valid_days": 1,
    "refund_policy": "演示内容",
    "rule_version_id": "1",
    "purchase_enabled": false,
    "unavailable_reason": "演示内容",
    "allowed_actions": [],
    "name": "演示资料",
    "cny_price_fen": "1",
    "pink_price": "1",
    "items": [
      {
        "valid_days": 1,
        "kind": "CONTRACT",
        "quantity": "1"
      }
    ],
    "allowed_cost_units": [
      "PINK_POINT"
    ]
  },
  "OwnEntitlementOfferList": {
    "items": [],
    "available_pink_units": "1",
    "rule_version_id": "1",
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "OwnEntitlementPurchaseCreateRequest": {
    "offer_code": "演示内容",
    "quantity": "1"
  },
  "OwnEntitlementPurchase": {
    "purchase_id": "demo-purchase",
    "purchase_no": "演示内容",
    "offer_code": "演示内容",
    "kind": "CONTRACT",
    "quantity": "1",
    "cost_unit": "CNY",
    "purchase_model": "PINK_IMMEDIATE",
    "unit_price": "1",
    "gross_cost": "1",
    "discount_cost": "1",
    "total_cost": "1",
    "rule_version_id": "1",
    "consideration_status": "UNPAID",
    "grant_status": "NOT_GRANTED",
    "refund_status": "NONE",
    "settled_at": "2026-10-14T06:00:00Z",
    "granted_at": "2026-10-14T06:00:00Z",
    "closed_at": "2026-10-14T06:00:00Z",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "version": "1",
    "allowed_actions": [],
    "replayed": false,
    "name": "演示资料",
    "cny_price_fen": "1",
    "pink_price": "1",
    "items": [
      {
        "valid_days": 1,
        "kind": "CONTRACT",
        "quantity": "1"
      }
    ]
  },
  "OpsCabinetStockingOptions": {
    "cabinet_readiness": {
      "eligible": false,
      "reason_code": "演示内容",
      "cabinet_version": "1"
    },
    "slots": [],
    "assets": {
      "items": [],
      "page": {
        "page_size": 1,
        "has_more": false,
        "next_cursor": "演示内容"
      }
    }
  },
  "OpsStorePlacementInput": {
    "location_kind": "STORE",
    "store_id": "demo-store",
    "evidence_set_id": "demo-evidence_set",
    "reason": "演示内容"
  },
  "OpsCabinetPlacementInput": {
    "location_kind": "CABINET",
    "cabinet_id": "demo-cabinet",
    "compartment_id": "demo-compartment",
    "reason": "演示内容"
  },
  "OpsPlacementInput": {
    "location_kind": "STORE",
    "store_id": "demo-store",
    "evidence_set_id": "demo-evidence_set",
    "reason": "演示内容"
  },
  "OpsPlacementEndInput": {
    "evidence_set_id": "demo-evidence_set",
    "reason": "演示内容"
  },
  "OpsPlacementRecord": {
    "placement_id": "demo-placement",
    "location_kind": "STORE",
    "store_id": "demo-store",
    "cabinet_id": "demo-cabinet",
    "compartment_id": "demo-compartment",
    "confirmed_at": "2026-10-14T06:00:00Z",
    "evidence_set_id": "demo-evidence_set",
    "version": "1",
    "asset_id": "demo-asset",
    "status": "ACTIVE",
    "ended_at": "2026-10-14T06:00:00Z",
    "ended_evidence_set_id": "demo-ended_evidence_set"
  },
  "OpsPlacementReceipt": {
    "schema_version": 1,
    "asset_id": "demo-asset",
    "state": {
      "schema_version": 1,
      "current_revision_id": "demo-current_revision",
      "latest_revision_id": "demo-latest_revision",
      "publish_status": "OFFLINE",
      "availability_status": "AVAILABLE",
      "version": "1"
    },
    "placement": {
      "placement_id": "demo-placement",
      "location_kind": "STORE",
      "store_id": "demo-store",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "confirmed_at": "2026-10-14T06:00:00Z",
      "evidence_set_id": "demo-evidence_set",
      "version": "1",
      "asset_id": "demo-asset",
      "status": "ACTIVE",
      "ended_at": "2026-10-14T06:00:00Z",
      "ended_evidence_set_id": "demo-ended_evidence_set"
    },
    "credential": {
      "credential_id": "demo-credential",
      "kind": "PICKUP",
      "status": "DORMANT",
      "generated_at": "2026-10-14T06:00:00Z"
    }
  },
  "OpsCabinetCredentialSummary": {
    "credential_id": "demo-credential",
    "kind": "PICKUP",
    "status": "DORMANT",
    "generated_at": "2026-10-14T06:00:00Z"
  },
  "OpsPlatformPriceGuidance": {
    "recommended_unit_price_fen": "1",
    "max_unit_price_fen": "1",
    "min_unit_price_fen": "1"
  },
  "OpsPlatformPublicationContext": {
    "pricing_guidance": {
      "recommended_unit_price_fen": "1",
      "max_unit_price_fen": "1",
      "min_unit_price_fen": "1"
    },
    "read_at": "2026-10-14T06:00:00Z",
    "official_lessor": {
      "lessor_id": "demo-lessor",
      "display_name": "演示资料"
    },
    "available_from": "2026-10-14T06:00:00Z",
    "available_until": "2026-10-14T06:00:00Z",
    "availability_policy": "OPEN_ENDED",
    "rule_version_id": "1",
    "product_id": "demo-product",
    "eligibility_rule_version_id": "1",
    "rental_unit": "HOUR",
    "creation_defaults": {
      "minimum_hourly_hours": 12,
      "rule_version_id": "1",
      "minimum_daily_days": 3
    }
  },
  "OwnAssetPublicationContext": {
    "product_id": "demo-product",
    "rental_unit": "DAY",
    "rule_version_id": "1",
    "eligibility_rule_version_id": "1",
    "read_at": "2026-10-14T06:00:00Z",
    "pricing_guidance": {
      "min_unit_price_fen": "1",
      "max_unit_price_fen": "1",
      "recommended_unit_price_fen": "1"
    }
  },
  "AssetDraftInput": {
    "product_id": "demo-product",
    "display_name": "演示资料",
    "condition": "演示内容",
    "defect_description": "演示内容",
    "accessories_text": "演示内容",
    "description": "演示内容",
    "identifier_type": "IMEI",
    "identifier_value": "演示内容",
    "rental_unit": "HOUR",
    "unit_price_fen": "1",
    "deposit_fen": "1",
    "minimum_units": "1",
    "reference_value_fen": "1",
    "available_from": "2026-10-14T06:00:00Z",
    "available_until": "2026-10-14T06:00:00Z",
    "timezone": "Asia/Shanghai",
    "publication_location": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "detail_address": "演示内容",
      "recipient_name": "演示内容",
      "phone_country_code": "+86",
      "phone": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    },
    "publication_position": {
      "latitude": "1",
      "longitude": "1",
      "coordinate_system": "GCJ02",
      "source": "WECHAT_CLIENT"
    },
    "media": [],
    "delivery_options": [],
    "rule_version_id": "1",
    "eligibility_rule_version_id": "1"
  },
  "SaveAssetDraft": {
    "asset": {
      "product_id": "demo-product",
      "display_name": "演示资料",
      "condition": "演示内容",
      "defect_description": "演示内容",
      "accessories_text": "演示内容",
      "description": "演示内容",
      "identifier_type": "IMEI",
      "identifier_value": "演示内容",
      "rental_unit": "HOUR",
      "unit_price_fen": "1",
      "deposit_fen": "1",
      "minimum_units": "1",
      "reference_value_fen": "1",
      "available_from": "2026-10-14T06:00:00Z",
      "available_until": "2026-10-14T06:00:00Z",
      "timezone": "Asia/Shanghai",
      "publication_location": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "detail_address": "演示内容",
        "recipient_name": "演示内容",
        "phone_country_code": "+86",
        "phone": "1",
        "location": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02",
          "source": "MAP_PICK"
        }
      },
      "publication_position": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "WECHAT_CLIENT"
      },
      "media": [],
      "delivery_options": [],
      "rule_version_id": "1",
      "eligibility_rule_version_id": "1"
    }
  },
  "PublicationEligibilityRequirement": {
    "code": "演示内容",
    "status": "SATISFIED",
    "required": false,
    "current_value": "演示内容",
    "required_value": "演示内容",
    "action": "演示内容"
  },
  "PublicationAgreementRequirement": {
    "document_version_id": "1",
    "kind": "演示内容",
    "title": "演示资料",
    "accepted": false
  },
  "OwnPublicationEligibility": {
    "eligible": false,
    "blocking_reasons": [],
    "eligibility_rule_version_id": "1",
    "agreement_rule_version_id": "1",
    "membership_rule_version_id": null,
    "minimum_level_code": "演示内容",
    "current_level_code": "演示内容",
    "identity_check_kind": "演示内容",
    "identity_check_id": null,
    "publish_quota_available": "1",
    "publish_quota_account_as_of_at": "2026-10-14T06:00:00Z",
    "publish_quota_expiry_pending": false,
    "agreements": [],
    "assets": {
      "total_count": "1",
      "online_count": "1",
      "editable_draft_count": "1"
    },
    "requirements": [],
    "as_of_at": "2026-10-14T06:00:00Z"
  },
  "PreparationReceipt": {
    "kind": "DRAFT",
    "id": "演示内容",
    "status": "EDITING",
    "version": "1",
    "asset_version": "1",
    "asset_id": "demo-asset",
    "revision_id": "demo-revision"
  },
  "OwnAssetDraft": {
    "draft_id": "demo-draft",
    "status": "EDITING",
    "version": "1",
    "asset": {
      "product_id": "demo-product",
      "display_name": "演示资料",
      "condition": "演示内容",
      "defect_description": "演示内容",
      "accessories_text": "演示内容",
      "description": "演示内容",
      "identifier_type": "IMEI",
      "identifier_value": "演示内容",
      "rental_unit": "HOUR",
      "unit_price_fen": "1",
      "deposit_fen": "1",
      "minimum_units": "1",
      "reference_value_fen": "1",
      "available_from": "2026-10-14T06:00:00Z",
      "available_until": "2026-10-14T06:00:00Z",
      "timezone": "Asia/Shanghai",
      "publication_location": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "detail_address": "演示内容",
        "recipient_name": "演示内容",
        "phone_country_code": "+86",
        "phone": "1",
        "location": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02",
          "source": "MAP_PICK"
        }
      },
      "publication_position": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "WECHAT_CLIENT"
      },
      "media": [],
      "delivery_options": [],
      "rule_version_id": "1",
      "eligibility_rule_version_id": "1"
    },
    "asset_id": "demo-asset",
    "committed_revision_id": "demo-committed_revision",
    "origin_kind": "CREATE",
    "base_version": "1"
  },
  "CreateEvidenceSet": {
    "purpose": "PUBLISH",
    "context": {
      "type": "DRAFT",
      "id": "演示内容"
    },
    "material_ids": [
      "演示内容"
    ]
  },
  "UpdateEvidenceSet": {
    "material_ids": [
      "演示内容"
    ]
  },
  "SubmitEvidenceSet": {
    "submitted": true
  },
  "PublicationEvidence": {
    "evidence_set_id": "demo-evidence_set",
    "purpose": "PUBLISH",
    "context": {
      "type": "DRAFT",
      "id": "演示内容"
    },
    "status": "DRAFT",
    "version": "1",
    "items": []
  },
  "AssetSubmissionReceipt": {
    "kind": "DRAFT",
    "id": "演示内容",
    "status": "SUBMITTED",
    "version": "1",
    "asset_id": "demo-asset",
    "revision_id": "demo-revision"
  },
  "CreatePublicationEvidenceSet": {
    "purpose": "PUBLISH",
    "context": {
      "type": "DRAFT",
      "id": "演示内容"
    },
    "material_ids": [
      "演示内容"
    ]
  },
  "CreateAssetHandoverEvidenceSet": {
    "purpose": "HANDOVER",
    "context": {
      "type": "ASSET",
      "id": "演示内容"
    },
    "material_ids": [
      "演示内容"
    ]
  },
  "AssetHandoverEvidence": {
    "evidence_set_id": "demo-evidence_set",
    "purpose": "HANDOVER",
    "context": {
      "type": "ASSET",
      "id": "演示内容"
    },
    "status": "DRAFT",
    "version": "1",
    "items": []
  },
  "EvidenceSet": {
    "evidence_set_id": "demo-evidence_set",
    "purpose": "PUBLISH",
    "context": {
      "type": "DRAFT",
      "id": "演示内容"
    },
    "status": "DRAFT",
    "version": "1",
    "items": []
  },
  "ProductMedia": {
    "material_id": "demo-material",
    "role": "COVER",
    "sort_order": 0
  },
  "ProductInput": {
    "name": "演示资料",
    "brand_id": "demo-brand",
    "category_id": "demo-category",
    "model": "演示内容",
    "description": "演示内容",
    "tags": [],
    "media": []
  },
  "ProductPatch": {
    "name": "演示资料",
    "brand_id": "demo-brand",
    "category_id": "demo-category",
    "model": "演示内容",
    "description": "演示内容",
    "tags": [],
    "media": [],
    "reason": "演示内容"
  },
  "ProductReason": {
    "reason": "演示内容"
  },
  "Product": {
    "product_id": "demo-product",
    "product_no": "演示内容",
    "name": "演示资料",
    "brand_id": "demo-brand",
    "category_id": "demo-category",
    "model": "演示内容",
    "description": "演示内容",
    "tags": [],
    "media": [],
    "status": "DRAFT",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z"
  },
  "ProductView": {
    "product_id": "demo-product",
    "product_no": "演示内容",
    "name": "演示资料",
    "brand_id": "demo-brand",
    "category_id": "demo-category",
    "model": "演示内容",
    "description": "演示内容",
    "tags": [],
    "media": [],
    "status": "DRAFT",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "brand_name": "演示内容",
    "category_name": "演示内容",
    "asset_count": "1",
    "allowed_actions": [],
    "blocked_reasons": []
  },
  "ProductPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "PublicLocationPoint": {
    "latitude": "1",
    "longitude": "1",
    "coordinate_system": "GCJ02"
  },
  "PublicRentalStoreAddress": {
    "dataset_id": "demo-dataset",
    "province_id": "demo-province",
    "city_id": "demo-city",
    "district_id": "demo-district",
    "province_name": "演示内容",
    "city_name": "演示内容",
    "district_name": "演示内容",
    "detail_address": "演示内容",
    "contact_name": "演示内容",
    "phone_dial": "1",
    "location": {
      "latitude": "1",
      "longitude": "1",
      "coordinate_system": "GCJ02"
    }
  },
  "PublicRentalCabinetAddress": {
    "dataset_id": "demo-dataset",
    "province_id": "demo-province",
    "city_id": "demo-city",
    "district_id": "demo-district",
    "province_name": "演示内容",
    "city_name": "演示内容",
    "district_name": "演示内容",
    "detail_address": "演示内容",
    "phone_dial": "1",
    "location": {
      "latitude": "1",
      "longitude": "1",
      "coordinate_system": "GCJ02"
    }
  },
  "PublicRentalStoreReference": {
    "store_id": "demo-store",
    "name": "演示资料"
  },
  "PublicLocationSupply": {
    "asset_id": "demo-asset",
    "asset_revision_id": "demo-asset_revision",
    "product_id": "demo-product",
    "display_name": "演示资料",
    "condition": "演示内容",
    "description": "演示内容",
    "defect_description": "演示内容",
    "accessories_text": "演示内容",
    "supply_type": "PERSONAL",
    "rental_mode": "DAY",
    "currency": "CNY",
    "unit_price_fen": "1",
    "deposit_fen": "1",
    "reference_value_fen": "1",
    "minimum_units": "1",
    "version": "1",
    "available_from": "2026-10-14T06:00:00Z",
    "available_until": "2026-10-14T06:00:00Z",
    "region": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容"
    },
    "media": [],
    "delivery_methods": [],
    "pickup_location": {
      "cabinet_id": "demo-cabinet",
      "name": "演示资料",
      "address": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "province_name": "演示内容",
        "city_name": "演示内容",
        "district_name": "演示内容",
        "detail_address": "演示内容",
        "phone_dial": "1",
        "location": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02"
        }
      }
    },
    "allowed_actions": [],
    "placement_confirmed_at": "2026-10-14T06:00:00Z"
  },
  "PublicRentalStore": {
    "store_id": "demo-store",
    "name": "演示资料",
    "address": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容",
      "detail_address": "演示内容",
      "contact_name": "演示内容",
      "phone_dial": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02"
      }
    },
    "business_hours": {
      "timezone": "Asia/Shanghai",
      "week": [
        {
          "day": 1,
          "closed": false,
          "intervals": []
        },
        {
          "day": 1,
          "closed": false,
          "intervals": []
        }
      ]
    },
    "photos": [],
    "cover": {
      "material_id": "demo-material",
      "url": "演示内容",
      "sort_order": 0
    },
    "photo_material_ids": [],
    "status": "演示内容",
    "supplies": [],
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z"
  },
  "PublicRentalCabinet": {
    "pickup_scene": "演示内容",
    "cabinet_id": "demo-cabinet",
    "name": "演示资料",
    "description": "演示内容",
    "deployment_site_name": "演示内容",
    "address": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容",
      "detail_address": "演示内容",
      "phone_dial": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02"
      }
    },
    "store": {
      "store_id": "demo-store",
      "name": "演示资料"
    },
    "status": "演示内容",
    "supplies": [],
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z"
  },
  "PublicRentalStorePage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "PublicRentalCabinetPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "RentalResourceID": "演示内容",
  "AdministrativeRegion": {
    "region_id": "demo-region",
    "parent_id": "demo-parent",
    "node_code": "演示内容",
    "name": "演示资料",
    "level": "PROVINCE",
    "code_kind": "SOURCE_ADMINISTRATIVE",
    "is_virtual": false
  },
  "AdministrativeRegionChildren": {
    "dataset_id": {
      "0": "d",
      "1": "e",
      "2": "m",
      "3": "o",
      "4": "-",
      "5": "d",
      "6": "a",
      "7": "t",
      "8": "a",
      "9": "s",
      "10": "e",
      "11": "t"
    },
    "parent_id": "demo-parent",
    "items": []
  },
  "StoreAddress": {
    "dataset_id": "demo-dataset",
    "province_id": "demo-province",
    "city_id": "demo-city",
    "district_id": "demo-district",
    "detail_address": "演示内容",
    "contact_name": "演示内容",
    "phone_dial": "1",
    "location": {
      "latitude": "1",
      "longitude": "1",
      "coordinate_system": "GCJ02",
      "source": "MAP_PICK"
    }
  },
  "BusinessInterval": {
    "start": "1",
    "end": "1"
  },
  "BusinessDay": {
    "day": 1,
    "closed": false,
    "intervals": []
  },
  "BusinessHours": {
    "timezone": "Asia/Shanghai",
    "week": [
      {
        "day": 1,
        "closed": false,
        "intervals": []
      },
      {
        "day": 1,
        "closed": false,
        "intervals": []
      }
    ]
  },
  "Store": {
    "store_id": "demo-store",
    "merchant_id": "demo-merchant",
    "responsible_lessor_id": "demo-responsible_lessor",
    "name": "演示资料",
    "address": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "detail_address": "演示内容",
      "contact_name": "演示内容",
      "phone_dial": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    },
    "province_name": "演示内容",
    "city_name": "演示内容",
    "district_name": "演示内容",
    "business_hours": {
      "timezone": "Asia/Shanghai",
      "week": [
        {
          "day": 1,
          "closed": false,
          "intervals": []
        },
        {
          "day": 1,
          "closed": false,
          "intervals": []
        }
      ]
    },
    "status": "ACTIVE",
    "archive_reason": "演示内容",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "location_verified_at": "2026-10-14T06:00:00Z",
    "photo_material_ids": []
  },
  "StoreView": {
    "store_id": "demo-store",
    "merchant_id": "demo-merchant",
    "responsible_lessor_id": "demo-responsible_lessor",
    "name": "演示资料",
    "address": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "detail_address": "演示内容",
      "contact_name": "演示内容",
      "phone_dial": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    },
    "province_name": "演示内容",
    "city_name": "演示内容",
    "district_name": "演示内容",
    "business_hours": {
      "timezone": "Asia/Shanghai",
      "week": [
        {
          "day": 1,
          "closed": false,
          "intervals": []
        },
        {
          "day": 1,
          "closed": false,
          "intervals": []
        }
      ]
    },
    "status": "ACTIVE",
    "archive_reason": "演示内容",
    "version": "1",
    "created_at": "2026-10-14T06:00:00Z",
    "updated_at": "2026-10-14T06:00:00Z",
    "location_verified_at": "2026-10-14T06:00:00Z",
    "allowed_actions": [],
    "blocked_reasons": [],
    "photo_material_ids": []
  },
  "StoreInput": {
    "merchant_id": "demo-merchant",
    "responsible_lessor_id": "demo-responsible_lessor",
    "name": "演示资料",
    "address": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "detail_address": "演示内容",
      "contact_name": "演示内容",
      "phone_dial": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02",
        "source": "MAP_PICK"
      }
    },
    "business_hours": {
      "timezone": "Asia/Shanghai",
      "week": [
        {
          "day": 1,
          "closed": false,
          "intervals": []
        },
        {
          "day": 1,
          "closed": false,
          "intervals": []
        }
      ]
    },
    "photo_material_ids": []
  },
  "StorePatch": "演示内容",
  "StoreReason": {
    "reason": "演示内容"
  },
  "StorePage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    }
  },
  "RentalSupplyPage": {
    "items": [],
    "page": {
      "page_size": 1,
      "has_more": false,
      "next_cursor": "演示内容"
    },
    "facets": {
      "categories": []
    }
  },
  "RentalSupply": {
    "asset_id": "demo-asset",
    "asset_revision_id": "demo-asset_revision",
    "product_id": "demo-product",
    "display_name": "演示资料",
    "condition": "演示内容",
    "description": "演示内容",
    "defect_description": "演示内容",
    "accessories_text": "演示内容",
    "supply_type": "PERSONAL",
    "rental_mode": "DAY",
    "currency": "CNY",
    "unit_price_fen": "1",
    "deposit_fen": "1",
    "reference_value_fen": "1",
    "minimum_units": "1",
    "version": "1",
    "available_from": "2026-10-14T06:00:00Z",
    "available_until": "2026-10-14T06:00:00Z",
    "region": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容"
    },
    "media": [],
    "delivery_methods": [],
    "allowed_actions": [],
    "pickup_location": {
      "cabinet_id": "demo-cabinet",
      "name": "演示资料",
      "address": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "province_name": "演示内容",
        "city_name": "演示内容",
        "district_name": "演示内容",
        "detail_address": "演示内容",
        "phone_dial": "1",
        "location": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02"
        }
      }
    }
  },
  "RentalSupplyMedia": {
    "material_id": "demo-material",
    "role": "COVER",
    "sort_order": 0,
    "url": "演示内容",
    "mime_type": "演示内容",
    "size_bytes": 1,
    "metadata": {
      "schema_version": 1,
      "width": 1,
      "height": 1,
      "duration_ms": 1,
      "video_codec": "演示内容",
      "audio_codec": "演示内容"
    },
    "poster": {
      "material_id": "demo-material",
      "url": "演示内容",
      "width": 1,
      "height": 1
    }
  },
  "RentalSupplyPickupLocation": {
    "cabinet_id": "demo-cabinet",
    "name": "演示资料",
    "address": {
      "dataset_id": "demo-dataset",
      "province_id": "demo-province",
      "city_id": "demo-city",
      "district_id": "demo-district",
      "province_name": "演示内容",
      "city_name": "演示内容",
      "district_name": "演示内容",
      "detail_address": "演示内容",
      "phone_dial": "1",
      "location": {
        "latitude": "1",
        "longitude": "1",
        "coordinate_system": "GCJ02"
      }
    }
  },
  "WechatNotificationEnvelope": {
    "id": "演示内容",
    "create_time": "2026-10-14T06:00:00Z",
    "event_type": "TRANSACTION.SUCCESS",
    "resource_type": "encrypt-resource",
    "summary": "演示内容",
    "resource": {
      "algorithm": "AEAD_AES_256_GCM",
      "original_type": "transaction",
      "ciphertext": "演示内容",
      "nonce": "演示内容",
      "associated_data": "演示内容"
    }
  },
  "WechatNotificationFailure": {
    "code": "FAIL",
    "message": "演示内容"
  }
};
export const routes = [
  {
    "path": "/v1/discovery/rental-supplies",
    "method": "GET",
    "status": 200,
    "schema": "DiscoverySupplyPage",
    "sample": {
      "items": [],
      "page": {
        "page_size": 1,
        "has_more": false,
        "next_cursor": "演示内容"
      },
      "facets": {
        "categories": []
      },
      "filters": {
        "city_id": "demo-city",
        "category_id": "demo-category",
        "supply_type": "演示内容",
        "query": "演示内容"
      }
    },
    "operation": "listDiscoveryRentalSupplies"
  },
  {
    "path": "/v1/discovery/rental-supplies/{id}",
    "method": "GET",
    "status": 200,
    "schema": "DiscoverySupply",
    "sample": {
      "asset_id": "demo-asset",
      "display_name": "演示资料",
      "category": {
        "category_id": "demo-category",
        "name": "演示资料"
      },
      "supply_type": "PERSONAL",
      "rental_mode": "DAY",
      "currency": "CNY",
      "unit_price_fen": "1",
      "deposit_fen": "1",
      "condition": "演示内容",
      "description": "演示内容",
      "availability_status": "AVAILABLE",
      "region": {
        "city_id": "demo-city",
        "city_name": "演示内容",
        "district_id": "demo-district",
        "district_name": "演示内容"
      },
      "media": []
    },
    "operation": "getDiscoveryRentalSupply"
  },
  {
    "path": "/v1/discovery/stores",
    "method": "GET",
    "status": 200,
    "schema": "DiscoveryStorePage",
    "sample": {
      "items": [],
      "page": {
        "page_size": 1,
        "has_more": false,
        "next_cursor": "演示内容"
      },
      "filters": {
        "city_id": "demo-city"
      }
    },
    "operation": "listDiscoveryStores"
  },
  {
    "path": "/v1/discovery/stores/{id}",
    "method": "GET",
    "status": 200,
    "schema": "DiscoveryStore",
    "sample": {
      "store_id": "demo-store",
      "name": "演示资料",
      "region": {
        "city_id": "demo-city",
        "city_name": "演示内容",
        "district_id": "demo-district",
        "district_name": "演示内容"
      },
      "status": "ACTIVE",
      "cover": {
        "material_id": "demo-material",
        "role": "COVER",
        "sort_order": 0,
        "url": "演示内容",
        "mime_type": "演示内容",
        "size_bytes": 1,
        "metadata": {
          "schema_version": 1,
          "width": 1,
          "height": 1,
          "duration_ms": 1,
          "video_codec": "演示内容",
          "audio_codec": "演示内容"
        },
        "poster": {
          "material_id": "demo-material",
          "url": "演示内容",
          "width": 1,
          "height": 1
        }
      },
      "business_hours": {
        "timezone": "Asia/Shanghai",
        "week": [
          {
            "day": 1,
            "closed": false,
            "intervals": []
          },
          {
            "day": 1,
            "closed": false,
            "intervals": []
          }
        ]
      },
      "public_address": "演示内容",
      "public_phone": "演示内容",
      "supplies": [],
      "media": []
    },
    "operation": "getDiscoveryStore"
  },
  {
    "path": "/v1/rental-supplies",
    "method": "GET",
    "status": 200,
    "schema": "RentalSupplyPage",
    "sample": {
      "items": [],
      "page": {
        "page_size": 1,
        "has_more": false,
        "next_cursor": "演示内容"
      },
      "facets": {
        "categories": []
      }
    },
    "operation": "listRentalSupplies"
  },
  {
    "path": "/v1/rental-supplies/{asset_id}",
    "method": "GET",
    "status": 200,
    "schema": "RentalSupply",
    "sample": {
      "asset_id": "demo-asset",
      "asset_revision_id": "demo-asset_revision",
      "product_id": "demo-product",
      "display_name": "演示资料",
      "condition": "演示内容",
      "description": "演示内容",
      "defect_description": "演示内容",
      "accessories_text": "演示内容",
      "supply_type": "PERSONAL",
      "rental_mode": "DAY",
      "currency": "CNY",
      "unit_price_fen": "1",
      "deposit_fen": "1",
      "reference_value_fen": "1",
      "minimum_units": "1",
      "version": "1",
      "available_from": "2026-10-14T06:00:00Z",
      "available_until": "2026-10-14T06:00:00Z",
      "region": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "province_name": "演示内容",
        "city_name": "演示内容",
        "district_name": "演示内容"
      },
      "media": [],
      "delivery_methods": [],
      "allowed_actions": [],
      "pickup_location": {
        "cabinet_id": "demo-cabinet",
        "name": "演示资料",
        "address": {
          "dataset_id": "demo-dataset",
          "province_id": "demo-province",
          "city_id": "demo-city",
          "district_id": "demo-district",
          "province_name": "演示内容",
          "city_name": "演示内容",
          "district_name": "演示内容",
          "detail_address": "演示内容",
          "phone_dial": "1",
          "location": {
            "latitude": "1",
            "longitude": "1",
            "coordinate_system": "GCJ02"
          }
        }
      }
    },
    "operation": "getRentalSupply"
  },
  {
    "path": "/v1/me/cash-balance",
    "method": "GET",
    "status": 200,
    "schema": "CashBalance",
    "sample": {
      "currency": "CNY",
      "available_fen": "1",
      "frozen_fen": "1",
      "withdrawable_fen": "1",
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getOwnCashBalance"
  },
  {
    "path": "/v1/me/withdrawals",
    "method": "POST",
    "status": 200,
    "schema": "WithdrawalReceipt",
    "sample": {
      "withdrawal": {
        "withdrawal_id": "demo-withdrawal",
        "amount_fen": "1",
        "currency": "CNY",
        "provider": "WECHAT",
        "provider_config_version_id": "1",
        "status": "PENDING_REVIEW",
        "frozen_journal_id": "demo-frozen_journal",
        "payout_id": "demo-payout",
        "reviewed_at": "2026-10-14T06:00:00Z",
        "review_reason": "演示内容",
        "created_at": "2026-10-14T06:00:00Z",
        "updated_at": "2026-10-14T06:00:00Z",
        "version": "1"
      },
      "balance": {
        "currency": "CNY",
        "available_fen": "1",
        "frozen_fen": "1",
        "withdrawable_fen": "1",
        "as_of_at": "2026-10-14T06:00:00Z"
      },
      "replayed": false
    },
    "operation": "createOwnWithdrawal"
  },
  {
    "path": "/v1/me/withdrawals",
    "method": "GET",
    "status": 200,
    "schema": "",
    "sample": {
      "items": [],
      "page": {
        "page_size": 1,
        "has_more": false,
        "next_cursor": "演示内容"
      }
    },
    "operation": "listOwnWithdrawals"
  },
  {
    "path": "/v1/me/entitlement-offers",
    "method": "GET",
    "status": 200,
    "schema": "OwnEntitlementOfferList",
    "sample": {
      "items": [],
      "available_pink_units": "1",
      "rule_version_id": "1",
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "listOwnEntitlementOffers"
  },
  {
    "path": "/v1/me/entitlement-purchases",
    "method": "POST",
    "status": 200,
    "schema": "OwnEntitlementPurchase",
    "sample": {
      "purchase_id": "demo-purchase",
      "purchase_no": "演示内容",
      "offer_code": "演示内容",
      "kind": "CONTRACT",
      "quantity": "1",
      "cost_unit": "CNY",
      "purchase_model": "PINK_IMMEDIATE",
      "unit_price": "1",
      "gross_cost": "1",
      "discount_cost": "1",
      "total_cost": "1",
      "rule_version_id": "1",
      "consideration_status": "UNPAID",
      "grant_status": "NOT_GRANTED",
      "refund_status": "NONE",
      "settled_at": "2026-10-14T06:00:00Z",
      "granted_at": "2026-10-14T06:00:00Z",
      "closed_at": "2026-10-14T06:00:00Z",
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "replayed": false,
      "name": "演示资料",
      "cny_price_fen": "1",
      "pink_price": "1",
      "items": [
        {
          "valid_days": 1,
          "kind": "CONTRACT",
          "quantity": "1"
        }
      ]
    },
    "operation": "createOwnEntitlementPurchase"
  },
  {
    "path": "/v1/me/entitlement-purchases/{purchase_id}",
    "method": "GET",
    "status": 200,
    "schema": "OwnEntitlementPurchase",
    "sample": {
      "purchase_id": "demo-purchase",
      "purchase_no": "演示内容",
      "offer_code": "演示内容",
      "kind": "CONTRACT",
      "quantity": "1",
      "cost_unit": "CNY",
      "purchase_model": "PINK_IMMEDIATE",
      "unit_price": "1",
      "gross_cost": "1",
      "discount_cost": "1",
      "total_cost": "1",
      "rule_version_id": "1",
      "consideration_status": "UNPAID",
      "grant_status": "NOT_GRANTED",
      "refund_status": "NONE",
      "settled_at": "2026-10-14T06:00:00Z",
      "granted_at": "2026-10-14T06:00:00Z",
      "closed_at": "2026-10-14T06:00:00Z",
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "replayed": false,
      "name": "演示资料",
      "cny_price_fen": "1",
      "pink_price": "1",
      "items": [
        {
          "valid_days": 1,
          "kind": "CONTRACT",
          "quantity": "1"
        }
      ]
    },
    "operation": "getOwnEntitlementPurchase"
  },
  {
    "path": "/v1/me/point-entries",
    "method": "GET",
    "status": 200,
    "schema": "OwnPointEntryPage",
    "sample": {
      "account_id": "demo-account",
      "account": {
        "point_kind": "演示内容",
        "total_earned_points": "1",
        "available_points": "1",
        "reserved_points": "1",
        "latest_sequence": "1"
      },
      "items": [],
      "statistics": {
        "timezone": "Asia/Shanghai",
        "day_start": "2026-10-14T06:00:00Z",
        "week_start": "2026-10-14T06:00:00Z",
        "today_earned_delta": "1",
        "week_earned_delta": "1",
        "month_start": "2026-10-14T06:00:00Z",
        "month_increase_units": "1",
        "month_decrease_units": "1"
      },
      "as_of_at": "2026-10-14T06:00:00Z",
      "page": {
        "next_cursor": "演示内容"
      }
    },
    "operation": "listOwnPointEntries"
  },
  {
    "path": "/v1/me/wechat-subscription-observations",
    "method": "POST",
    "status": 201,
    "schema": "WechatSubscriptionObservation",
    "sample": {
      "subscription_id": "demo-subscription",
      "scene": "演示内容",
      "template_id": "demo-template",
      "client_result": "ACCEPT",
      "observed_at": "2026-10-14T06:00:00Z",
      "status": "OBSERVED",
      "version": 1,
      "created_at": "2026-10-14T06:00:00Z"
    },
    "operation": "recordWechatSubscriptionObservation"
  },
  {
    "path": "/v1/me/catalog/categories",
    "method": "GET",
    "status": 200,
    "schema": "OwnCatalogCategoryList",
    "sample": {
      "items": []
    },
    "operation": "listOwnCatalogCategories"
  },
  {
    "path": "/v1/me/catalog/products",
    "method": "GET",
    "status": 200,
    "schema": "OwnCatalogProductPage",
    "sample": {
      "items": [],
      "page": {
        "page_size": 1,
        "has_more": false,
        "next_cursor": "演示内容"
      }
    },
    "operation": "listOwnCatalogProducts"
  },
  {
    "path": "/v1/me/catalog/products/{product_id}",
    "method": "GET",
    "status": 200,
    "schema": "OwnCatalogProduct",
    "sample": {
      "product_id": "demo-product",
      "name": "演示资料",
      "model": "演示内容",
      "description": "演示内容",
      "brand_id": "demo-brand",
      "brand_name": "演示内容",
      "category_id": "demo-category",
      "category_name": "演示内容",
      "tags": [],
      "media": [],
      "updated_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getOwnCatalogProduct"
  },
  {
    "path": "/v1/me/coupons",
    "method": "GET",
    "status": 200,
    "schema": "MemberCouponPage",
    "sample": {
      "items": [],
      "page": {
        "next_cursor": "演示内容"
      },
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "listOwnCoupons"
  },
  {
    "path": "/v1/me/asset-publication-context",
    "method": "GET",
    "status": 200,
    "schema": "OwnAssetPublicationContext",
    "sample": {
      "product_id": "demo-product",
      "rental_unit": "DAY",
      "rule_version_id": "1",
      "eligibility_rule_version_id": "1",
      "read_at": "2026-10-14T06:00:00Z",
      "pricing_guidance": {
        "min_unit_price_fen": "1",
        "max_unit_price_fen": "1",
        "recommended_unit_price_fen": "1"
      }
    },
    "operation": "getOwnAssetPublicationContext"
  },
  {
    "path": "/v1/me/publication-eligibility",
    "method": "GET",
    "status": 200,
    "schema": "OwnPublicationEligibility",
    "sample": {
      "eligible": false,
      "blocking_reasons": [],
      "eligibility_rule_version_id": "1",
      "agreement_rule_version_id": "1",
      "membership_rule_version_id": null,
      "minimum_level_code": "演示内容",
      "current_level_code": "演示内容",
      "identity_check_kind": "演示内容",
      "identity_check_id": null,
      "publish_quota_available": "1",
      "publish_quota_account_as_of_at": "2026-10-14T06:00:00Z",
      "publish_quota_expiry_pending": false,
      "agreements": [],
      "assets": {
        "total_count": "1",
        "online_count": "1",
        "editable_draft_count": "1"
      },
      "requirements": [],
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getOwnPublicationEligibility"
  },
  {
    "path": "/v1/me/rental-assets",
    "method": "GET",
    "status": 200,
    "schema": "OwnRentalAssetPage",
    "sample": {
      "items": [],
      "page": {
        "page_size": 1,
        "has_more": false,
        "next_cursor": "演示内容"
      }
    },
    "operation": "listOwnRentalAssets"
  },
  {
    "path": "/v1/me/rental-assets/{asset_id}",
    "method": "GET",
    "status": 200,
    "schema": "OwnRentalAssetDetail",
    "sample": {
      "item": {
        "resource_kind": "ASSET",
        "resource_id": "demo-resource",
        "asset_id": "demo-asset",
        "draft_id": "demo-draft",
        "origin_kind": "CREATE",
        "product_id": "demo-product",
        "product_name": "演示内容",
        "display_name": "演示资料",
        "state": "DRAFT",
        "publish_status": "ONLINE",
        "availability_status": "AVAILABLE",
        "latest_review_status": "PENDING",
        "current_revision_id": "demo-current_revision",
        "latest_revision_id": "demo-latest_revision",
        "rental_unit": "HOUR",
        "unit_price_fen": "1",
        "deposit_fen": "1",
        "cover_material_id": "demo-cover_material",
        "delivery_methods": [],
        "editable_draft_id": "demo-editable_draft",
        "allowed_actions": [],
        "created_at": "2026-10-14T06:00:00Z",
        "updated_at": "2026-10-14T06:00:00Z",
        "version": "1"
      },
      "current_revision": {
        "revision_id": "demo-revision",
        "asset_id": "demo-asset",
        "revision_no": "1",
        "product_id": "demo-product",
        "display_name": "演示资料",
        "rental_unit": "HOUR",
        "unit_price_fen": "1",
        "deposit_fen": "1",
        "minimum_units": "1",
        "reference_value_fen": "1",
        "currency": "CNY",
        "available_from": "2026-10-14T06:00:00Z",
        "available_until": "2026-10-14T06:00:00Z",
        "timezone": "Asia/Shanghai",
        "rule_version_id": "1",
        "eligibility_rule_version_id": "1",
        "identity_check_id": "demo-identity_check",
        "submitted_by": "演示内容",
        "submitted_at": "2026-10-14T06:00:00Z",
        "review_status": "PENDING",
        "reviewed_by": "演示内容",
        "reviewed_at": "2026-10-14T06:00:00Z",
        "review_reason": "演示内容",
        "condition": "演示内容",
        "defect_description": "演示内容",
        "accessories_text": "演示内容",
        "description": "演示内容",
        "product_snapshot": {
          "schema_version": 1,
          "product_id": "demo-product",
          "product_no": "演示内容",
          "brand_id": "demo-brand",
          "brand_name": "演示内容",
          "category_id": "demo-category",
          "category_name": "演示内容",
          "model_name": "演示内容",
          "product_name": "演示内容",
          "tags": [],
          "cover_material_id": "demo-cover_material"
        },
        "pricing_guidance_snapshot": {
          "schema_version": 1,
          "config_version_id": "1",
          "min_unit_price_fen": "1",
          "max_unit_price_fen": "1",
          "recommended_unit_price_fen": "1",
          "rental_mode": "HOUR",
          "captured_at": "2026-10-14T06:00:00Z"
        },
        "publication_region": {
          "dataset_id": "demo-dataset",
          "province_id": "demo-province",
          "city_id": "demo-city",
          "district_id": "demo-district",
          "province_name": "演示内容",
          "city_name": "演示内容",
          "district_name": "演示内容"
        },
        "media": [],
        "delivery_options": []
      },
      "latest_revision": {
        "revision_id": "demo-revision",
        "asset_id": "demo-asset",
        "revision_no": "1",
        "product_id": "demo-product",
        "display_name": "演示资料",
        "rental_unit": "HOUR",
        "unit_price_fen": "1",
        "deposit_fen": "1",
        "minimum_units": "1",
        "reference_value_fen": "1",
        "currency": "CNY",
        "available_from": "2026-10-14T06:00:00Z",
        "available_until": "2026-10-14T06:00:00Z",
        "timezone": "Asia/Shanghai",
        "rule_version_id": "1",
        "eligibility_rule_version_id": "1",
        "identity_check_id": "demo-identity_check",
        "submitted_by": "演示内容",
        "submitted_at": "2026-10-14T06:00:00Z",
        "review_status": "PENDING",
        "reviewed_by": "演示内容",
        "reviewed_at": "2026-10-14T06:00:00Z",
        "review_reason": "演示内容",
        "condition": "演示内容",
        "defect_description": "演示内容",
        "accessories_text": "演示内容",
        "description": "演示内容",
        "product_snapshot": {
          "schema_version": 1,
          "product_id": "demo-product",
          "product_no": "演示内容",
          "brand_id": "demo-brand",
          "brand_name": "演示内容",
          "category_id": "demo-category",
          "category_name": "演示内容",
          "model_name": "演示内容",
          "product_name": "演示内容",
          "tags": [],
          "cover_material_id": "demo-cover_material"
        },
        "pricing_guidance_snapshot": {
          "schema_version": 1,
          "config_version_id": "1",
          "min_unit_price_fen": "1",
          "max_unit_price_fen": "1",
          "recommended_unit_price_fen": "1",
          "rental_mode": "HOUR",
          "captured_at": "2026-10-14T06:00:00Z"
        },
        "publication_region": {
          "dataset_id": "demo-dataset",
          "province_id": "demo-province",
          "city_id": "demo-city",
          "district_id": "demo-district",
          "province_name": "演示内容",
          "city_name": "演示内容",
          "district_name": "演示内容"
        },
        "media": [],
        "delivery_options": []
      },
      "publication_blockers": [],
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getOwnRentalAsset"
  },
  {
    "path": "/v1/me/asset-drafts/{id}/submissions",
    "method": "POST",
    "status": 200,
    "schema": "AssetSubmissionReceipt",
    "sample": {
      "kind": "DRAFT",
      "id": "演示内容",
      "status": "SUBMITTED",
      "version": "1",
      "asset_id": "demo-asset",
      "revision_id": "demo-revision"
    },
    "operation": "submitOwnAssetDraft"
  },
  {
    "path": "/v1/me/assets/{id}/drafts",
    "method": "POST",
    "status": 201,
    "schema": "PreparationReceipt",
    "sample": {
      "kind": "DRAFT",
      "id": "演示内容",
      "status": "EDITING",
      "version": "1",
      "asset_version": "1",
      "asset_id": "demo-asset",
      "revision_id": "demo-revision"
    },
    "operation": "createOwnAssetEditDraft"
  },
  {
    "path": "/v1/me/check-ins",
    "method": "GET",
    "status": 200,
    "schema": "CheckInMonth",
    "sample": {
      "month": "1",
      "today": "演示内容",
      "items": []
    },
    "operation": "listOwnCheckInsByMonth"
  },
  {
    "path": "/v1/me/check-ins",
    "method": "POST",
    "status": 200,
    "schema": "CheckInReceipt",
    "sample": {
      "check_in": {
        "check_in_id": "demo-check_in",
        "business_date": "演示内容",
        "timezone": "演示内容",
        "checked_in_at": "2026-10-14T06:00:00Z",
        "previous_check_in_id": null,
        "streak_days": "1",
        "cumulative_days": "1",
        "rule_version_id": "1"
      },
      "grants": []
    },
    "operation": "createOwnCheckIn"
  },
  {
    "path": "/v1/me/check-in-rule",
    "method": "GET",
    "status": 200,
    "schema": "CurrentCheckInRule",
    "sample": {
      "rule_version_id": "1",
      "policy": {
        "schema_version": 2,
        "timezone": "Asia/Shanghai",
        "daily_rewards": [],
        "first_rewards": [],
        "milestones": []
      }
    },
    "operation": "getOwnCurrentCheckInRule"
  },
  {
    "path": "/v1/me/benefits",
    "method": "GET",
    "status": 200,
    "schema": "MemberDossier",
    "sample": {
      "profile": {
        "account_id": "demo-account",
        "user_no": "演示内容",
        "display_name": "演示资料",
        "rental_status": "演示内容",
        "level_code": "演示内容",
        "total_growth_units": "1",
        "available_pink_units": "1",
        "first_registered_at": "2026-10-14T06:00:00Z",
        "version": "1"
      },
      "point_accounts": [],
      "entitlements": [],
      "allowances": [],
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getOwnBenefitSummary"
  },
  {
    "path": "/v1/me/asset-drafts",
    "method": "POST",
    "status": 201,
    "schema": "PreparationReceipt",
    "sample": {
      "kind": "DRAFT",
      "id": "演示内容",
      "status": "EDITING",
      "version": "1",
      "asset_version": "1",
      "asset_id": "demo-asset",
      "revision_id": "demo-revision"
    },
    "operation": "saveOwnAssetDraft"
  },
  {
    "path": "/v1/me/asset-drafts/{id}/updates",
    "method": "POST",
    "status": 200,
    "schema": "PreparationReceipt",
    "sample": {
      "kind": "DRAFT",
      "id": "演示内容",
      "status": "EDITING",
      "version": "1",
      "asset_version": "1",
      "asset_id": "demo-asset",
      "revision_id": "demo-revision"
    },
    "operation": "updateOwnAssetDraftFromMini"
  },
  {
    "path": "/v1/me/asset-drafts/{id}",
    "method": "PATCH",
    "status": 200,
    "schema": "PreparationReceipt",
    "sample": {
      "kind": "DRAFT",
      "id": "演示内容",
      "status": "EDITING",
      "version": "1",
      "asset_version": "1",
      "asset_id": "demo-asset",
      "revision_id": "demo-revision"
    },
    "operation": "updateOwnAssetDraft"
  },
  {
    "path": "/v1/me/asset-drafts/{id}",
    "method": "GET",
    "status": 200,
    "schema": "OwnAssetDraft",
    "sample": {
      "draft_id": "demo-draft",
      "status": "EDITING",
      "version": "1",
      "asset": {
        "product_id": "demo-product",
        "display_name": "演示资料",
        "condition": "演示内容",
        "defect_description": "演示内容",
        "accessories_text": "演示内容",
        "description": "演示内容",
        "identifier_type": "IMEI",
        "identifier_value": "演示内容",
        "rental_unit": "HOUR",
        "unit_price_fen": "1",
        "deposit_fen": "1",
        "minimum_units": "1",
        "reference_value_fen": "1",
        "available_from": "2026-10-14T06:00:00Z",
        "available_until": "2026-10-14T06:00:00Z",
        "timezone": "Asia/Shanghai",
        "publication_location": {
          "dataset_id": "demo-dataset",
          "province_id": "demo-province",
          "city_id": "demo-city",
          "district_id": "demo-district",
          "detail_address": "演示内容",
          "recipient_name": "演示内容",
          "phone_country_code": "+86",
          "phone": "1",
          "location": {
            "latitude": "1",
            "longitude": "1",
            "coordinate_system": "GCJ02",
            "source": "MAP_PICK"
          }
        },
        "publication_position": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02",
          "source": "WECHAT_CLIENT"
        },
        "media": [],
        "delivery_options": [],
        "rule_version_id": "1",
        "eligibility_rule_version_id": "1"
      },
      "asset_id": "demo-asset",
      "committed_revision_id": "demo-committed_revision",
      "origin_kind": "CREATE",
      "base_version": "1"
    },
    "operation": "getOwnAssetDraft"
  },
  {
    "path": "/v1/me/addresses",
    "method": "GET",
    "status": 200,
    "schema": "OwnAddressList",
    "sample": {
      "items": [],
      "page": {
        "page_size": 1,
        "has_more": false,
        "next_cursor": "演示内容"
      }
    },
    "operation": "listOwnAddresses"
  },
  {
    "path": "/v1/me/addresses",
    "method": "POST",
    "status": 201,
    "schema": "AddressReceipt",
    "sample": {
      "address_id": "demo-address",
      "version": "1",
      "status": "ACTIVE",
      "is_default": false
    },
    "operation": "createOwnAddress"
  },
  {
    "path": "/v1/me/addresses/{address_id}",
    "method": "PATCH",
    "status": 200,
    "schema": "AddressReceipt",
    "sample": {
      "address_id": "demo-address",
      "version": "1",
      "status": "ACTIVE",
      "is_default": false
    },
    "operation": "updateOwnAddress"
  },
  {
    "path": "/v1/me/addresses/{address_id}/archive",
    "method": "POST",
    "status": 200,
    "schema": "AddressReceipt",
    "sample": {
      "address_id": "demo-address",
      "version": "1",
      "status": "ACTIVE",
      "is_default": false
    },
    "operation": "archiveOwnAddress"
  },
  {
    "path": "/v1/me/addresses/{address_id}/default",
    "method": "POST",
    "status": 200,
    "schema": "AddressReceipt",
    "sample": {
      "address_id": "demo-address",
      "version": "1",
      "status": "ACTIVE",
      "is_default": false
    },
    "operation": "setOwnDefaultAddress"
  },
  {
    "path": "/v1/regions",
    "method": "GET",
    "status": 200,
    "schema": "AdministrativeRegionChildren",
    "sample": {
      "dataset_id": {
        "0": "d",
        "1": "e",
        "2": "m",
        "3": "o",
        "4": "-",
        "5": "d",
        "6": "a",
        "7": "t",
        "8": "a",
        "9": "s",
        "10": "e",
        "11": "t"
      },
      "parent_id": "demo-parent",
      "items": []
    },
    "operation": "listAdministrativeRegions"
  },
  {
    "path": "/v1/rental-cabinets/by-scene",
    "method": "GET",
    "status": 200,
    "schema": "PublicRentalCabinet",
    "sample": {
      "pickup_scene": "演示内容",
      "cabinet_id": "demo-cabinet",
      "name": "演示资料",
      "description": "演示内容",
      "deployment_site_name": "演示内容",
      "address": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "province_name": "演示内容",
        "city_name": "演示内容",
        "district_name": "演示内容",
        "detail_address": "演示内容",
        "phone_dial": "1",
        "location": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02"
        }
      },
      "store": {
        "store_id": "demo-store",
        "name": "演示资料"
      },
      "status": "演示内容",
      "supplies": [],
      "version": "1",
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getPublicRentalCabinetByScene"
  },
  {
    "path": "/v1/materials/files",
    "method": "POST",
    "status": 201,
    "schema": "MaterialFileResult",
    "sample": {
      "metadata": {
        "schema_version": 1,
        "width": 1,
        "height": 1,
        "duration_ms": 1,
        "video_codec": "演示内容",
        "audio_codec": "演示内容"
      },
      "poster": {
        "material_id": "demo-material",
        "url": "演示内容",
        "width": 1,
        "height": 1
      },
      "material_id": "demo-material",
      "upload_id": "demo-upload",
      "status": "UPLOADED",
      "public_url": "演示内容",
      "playback_url": "演示内容",
      "mime_type": "演示内容",
      "size_bytes": 1
    },
    "operation": "uploadMaterialFile"
  },
  {
    "path": "/v1/materials/{material_id}",
    "method": "GET",
    "status": 200,
    "schema": "Material",
    "sample": {
      "material_id": "demo-material",
      "owner_account_id": "demo-owner_account",
      "scope_type": "ACCOUNT",
      "scope_id": "demo-scope",
      "material_class": "PROFILE_IMAGE",
      "status": "PENDING_UPLOAD",
      "public_url": "演示内容",
      "playback_url": "演示内容",
      "metadata": {
        "schema_version": 1,
        "width": 1,
        "height": 1,
        "duration_ms": 1,
        "video_codec": "演示内容",
        "audio_codec": "演示内容"
      },
      "poster": {
        "material_id": "demo-material",
        "url": "演示内容",
        "width": 1,
        "height": 1
      },
      "mime_type": "演示内容",
      "size_bytes": 1,
      "object_version_id": "1",
      "object_etag": "演示内容",
      "expected_mime": "演示内容",
      "expected_size": 1,
      "expected_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "detected_mime": "演示内容",
      "observed_size": 0,
      "observed_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "sse_mode": "SSE-OSS",
      "scanner_verdict": "PASS",
      "rejection_reason": "演示内容",
      "authorization_expires_at": "2026-10-14T06:00:00Z",
      "version": 1,
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getMaterial"
  },
  {
    "path": "/v1/auth/wechat-mini/sessions",
    "method": "POST",
    "status": 201,
    "schema": "SessionResponse",
    "sample": {
      "access_token": "演示内容",
      "refresh_token": "演示内容",
      "token_type": "Bearer",
      "expires_in": 1,
      "account": {
        "display_name": "演示资料",
        "wechat_binding": {
          "status": "BOUND",
          "nickname": "演示内容",
          "avatar_material_id": null,
          "bound_at": null
        },
        "account_id": "demo-account",
        "audience": "MINIPROGRAM",
        "roles": [],
        "permissions": [],
        "scopes": []
      }
    },
    "operation": "createMiniProgramSession"
  },
  {
    "path": "/v1/auth/wechat-mini/phone-sessions",
    "method": "POST",
    "status": 201,
    "schema": "SessionResponse",
    "sample": {
      "access_token": "演示内容",
      "refresh_token": "演示内容",
      "token_type": "Bearer",
      "expires_in": 1,
      "account": {
        "display_name": "演示资料",
        "wechat_binding": {
          "status": "BOUND",
          "nickname": "演示内容",
          "avatar_material_id": null,
          "bound_at": null
        },
        "account_id": "demo-account",
        "audience": "MINIPROGRAM",
        "roles": [],
        "permissions": [],
        "scopes": []
      }
    },
    "operation": "createMiniProgramPhoneSession"
  },
  {
    "path": "/v1/auth/token/refresh",
    "method": "POST",
    "status": 200,
    "schema": "SessionResponse",
    "sample": {
      "access_token": "演示内容",
      "refresh_token": "演示内容",
      "token_type": "Bearer",
      "expires_in": 1,
      "account": {
        "display_name": "演示资料",
        "wechat_binding": {
          "status": "BOUND",
          "nickname": "演示内容",
          "avatar_material_id": null,
          "bound_at": null
        },
        "account_id": "demo-account",
        "audience": "MINIPROGRAM",
        "roles": [],
        "permissions": [],
        "scopes": []
      }
    },
    "operation": "refreshMiniProgramSession"
  },
  {
    "path": "/v1/auth/logout",
    "method": "POST",
    "status": 204,
    "schema": "",
    "sample": null,
    "operation": "logoutMiniProgramSession"
  },
  {
    "path": "/v1/auth/me",
    "method": "GET",
    "status": 200,
    "schema": "AccountView",
    "sample": {
      "display_name": "演示资料",
      "wechat_binding": {
        "status": "BOUND",
        "nickname": "演示内容",
        "avatar_material_id": null,
        "bound_at": null
      },
      "account_id": "demo-account",
      "audience": "MINIPROGRAM",
      "roles": [],
      "permissions": [],
      "scopes": []
    },
    "operation": "getMiniProgramCurrentAccount"
  },
  {
    "path": "/v1/me/authenticators",
    "method": "GET",
    "status": 200,
    "schema": "OwnAuthenticators",
    "sample": {
      "account_id": "demo-account",
      "security_version": 1,
      "phone_bound": false,
      "phone_masked": "1",
      "wechat_bound": false,
      "allowed_actions": []
    },
    "operation": "getOwnAuthenticators"
  },
  {
    "path": "/v1/me/phone-binding",
    "method": "POST",
    "status": 200,
    "schema": "OwnAuthenticators",
    "sample": {
      "account_id": "demo-account",
      "security_version": 1,
      "phone_bound": false,
      "phone_masked": "1",
      "wechat_bound": false,
      "allowed_actions": []
    },
    "operation": "bindOwnMiniPhone"
  },
  {
    "path": "/v1/me/phone-binding",
    "method": "DELETE",
    "status": 200,
    "schema": "OwnAuthenticators",
    "sample": {
      "account_id": "demo-account",
      "security_version": 1,
      "phone_bound": false,
      "phone_masked": "1",
      "wechat_bound": false,
      "allowed_actions": []
    },
    "operation": "unbindOwnMiniPhone"
  },
  {
    "path": "/v1/me/wechat-binding",
    "method": "POST",
    "status": 200,
    "schema": "OwnAuthenticators",
    "sample": {
      "account_id": "demo-account",
      "security_version": 1,
      "phone_bound": false,
      "phone_masked": "1",
      "wechat_bound": false,
      "allowed_actions": []
    },
    "operation": "bindOwnMiniWechat"
  },
  {
    "path": "/v1/me/identity",
    "method": "GET",
    "status": 200,
    "schema": "OwnIdentityStatus",
    "sample": {
      "overall_status": "NOT_VERIFIED",
      "real_name": {
        "status": "NOT_VERIFIED",
        "verification_id": "demo-verification",
        "can_create_verification": false,
        "verified_at": "2026-10-14T06:00:00Z",
        "valid_until": "2026-10-14T06:00:00Z"
      },
      "face": {
        "status": "NOT_VERIFIED",
        "verification_id": "demo-verification",
        "can_create_verification": false,
        "verified_at": "2026-10-14T06:00:00Z",
        "valid_until": "2026-10-14T06:00:00Z"
      }
    },
    "operation": "getOwnIdentityStatus"
  },
  {
    "path": "/v1/me/profile",
    "method": "GET",
    "status": 200,
    "schema": "AccountProfile",
    "sample": {
      "account_id": "demo-account",
      "display_name": "演示资料",
      "avatar_material_id": "demo-avatar_material",
      "locale": "zh-CN",
      "version": 1,
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getOwnAccountProfile"
  },
  {
    "path": "/v1/me/profile",
    "method": "PATCH",
    "status": 200,
    "schema": "AccountProfile",
    "sample": {
      "account_id": "demo-account",
      "display_name": "演示资料",
      "avatar_material_id": "demo-avatar_material",
      "locale": "zh-CN",
      "version": 1,
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z"
    },
    "operation": "updateOwnAccountProfile"
  },
  {
    "path": "/v1/me/addresses/{address_id}/updates",
    "method": "POST",
    "status": 200,
    "schema": "AddressReceipt",
    "sample": {
      "address_id": "demo-address",
      "version": "1",
      "status": "ACTIVE",
      "is_default": false
    },
    "operation": "updateOwnAddressFromMini"
  },
  {
    "path": "/v1/me/profile/updates",
    "method": "POST",
    "status": 200,
    "schema": "AccountProfile",
    "sample": {
      "account_id": "demo-account",
      "display_name": "演示资料",
      "avatar_material_id": "demo-avatar_material",
      "locale": "zh-CN",
      "version": 1,
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z"
    },
    "operation": "updateOwnAccountProfileFromMini"
  },
  {
    "path": "/v1/rental-stores",
    "method": "GET",
    "status": 200,
    "schema": "PublicRentalStorePage",
    "sample": {
      "items": [],
      "page": {
        "page_size": 1,
        "has_more": false,
        "next_cursor": "演示内容"
      }
    },
    "operation": "listPublicRentalStores"
  },
  {
    "path": "/v1/rental-stores/{store_id}",
    "method": "GET",
    "status": 200,
    "schema": "PublicRentalStore",
    "sample": {
      "store_id": "demo-store",
      "name": "演示资料",
      "address": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "province_name": "演示内容",
        "city_name": "演示内容",
        "district_name": "演示内容",
        "detail_address": "演示内容",
        "contact_name": "演示内容",
        "phone_dial": "1",
        "location": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02"
        }
      },
      "business_hours": {
        "timezone": "Asia/Shanghai",
        "week": [
          {
            "day": 1,
            "closed": false,
            "intervals": []
          },
          {
            "day": 1,
            "closed": false,
            "intervals": []
          }
        ]
      },
      "photos": [],
      "cover": {
        "material_id": "demo-material",
        "url": "演示内容",
        "sort_order": 0
      },
      "photo_material_ids": [],
      "status": "演示内容",
      "supplies": [],
      "version": "1",
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getPublicRentalStore"
  },
  {
    "path": "/v1/rental-cabinets",
    "method": "GET",
    "status": 200,
    "schema": "PublicRentalCabinetPage",
    "sample": {
      "items": [],
      "page": {
        "page_size": 1,
        "has_more": false,
        "next_cursor": "演示内容"
      }
    },
    "operation": "listPublicRentalCabinets"
  },
  {
    "path": "/v1/rental-cabinets/{cabinet_id}",
    "method": "GET",
    "status": 200,
    "schema": "PublicRentalCabinet",
    "sample": {
      "pickup_scene": "演示内容",
      "cabinet_id": "demo-cabinet",
      "name": "演示资料",
      "description": "演示内容",
      "deployment_site_name": "演示内容",
      "address": {
        "dataset_id": "demo-dataset",
        "province_id": "demo-province",
        "city_id": "demo-city",
        "district_id": "demo-district",
        "province_name": "演示内容",
        "city_name": "演示内容",
        "district_name": "演示内容",
        "detail_address": "演示内容",
        "phone_dial": "1",
        "location": {
          "latitude": "1",
          "longitude": "1",
          "coordinate_system": "GCJ02"
        }
      },
      "store": {
        "store_id": "demo-store",
        "name": "演示资料"
      },
      "status": "演示内容",
      "supplies": [],
      "version": "1",
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getPublicRentalCabinet"
  },
  {
    "path": "/v1/me/ops-wechat-challenges/inspect",
    "method": "POST",
    "status": 200,
    "schema": "Challenge",
    "sample": {
      "challenge_id": "demo-challenge",
      "purpose": "LOGIN",
      "status": "PENDING",
      "expires_at": "2026-10-14T06:00:00Z",
      "display_name": "演示资料",
      "phone_masked": "1",
      "poll_token": "演示内容",
      "code_image": "演示内容"
    },
    "operation": "inspectOpsWechatChallenge"
  },
  {
    "path": "/v1/me/ops-wechat-challenges/decisions",
    "method": "POST",
    "status": 200,
    "schema": "Challenge",
    "sample": {
      "challenge_id": "demo-challenge",
      "purpose": "LOGIN",
      "status": "PENDING",
      "expires_at": "2026-10-14T06:00:00Z",
      "display_name": "演示资料",
      "phone_masked": "1",
      "poll_token": "演示内容",
      "code_image": "演示内容"
    },
    "operation": "decideOpsWechatChallenge"
  },
  {
    "path": "/v1/me/lottery",
    "method": "GET",
    "status": 200,
    "schema": "LotteryState",
    "sample": {
      "account_id": "demo-account",
      "enabled": false,
      "blocked_reason": "演示内容",
      "cost_pink_units": "1",
      "available_pink_units": "1",
      "lottery_config_version_id": "1",
      "coupon_config_version_id": "1",
      "prizes": [
        {
          "prize_code": "DEPOSIT_WAIVER",
          "enabled": false,
          "remaining_qty": "1",
          "pink_reward_units": "1",
          "rights_display": {
            "kind": "DEPOSIT_WAIVER",
            "deposit_waiver": "FULL"
          }
        },
        {
          "prize_code": "DEPOSIT_WAIVER",
          "enabled": false,
          "remaining_qty": "1",
          "pink_reward_units": "1",
          "rights_display": {
            "kind": "DEPOSIT_WAIVER",
            "deposit_waiver": "FULL"
          }
        }
      ],
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getOwnLotteryState"
  },
  {
    "path": "/v1/me/lottery-draws",
    "method": "POST",
    "status": 200,
    "schema": "LotteryAttempt",
    "sample": {
      "state": "COMPLETED",
      "result_kind": "WIN",
      "draw_id": "demo-draw",
      "cost_pink_units": "1",
      "prize_code": "DEPOSIT_WAIVER",
      "prize_snapshot": {
        "prize_code": "DEPOSIT_WAIVER",
        "prize_qty": "1",
        "pink_reward_units": "1",
        "coupon_config_version_id": "1"
      },
      "pink_spend_entry_id": "demo-pink_spend_entry",
      "grant_id": "demo-grant",
      "inventory_movement_id": "demo-inventory_movement",
      "balance_after": "1"
    },
    "operation": "createOwnLotteryDraw"
  },
  {
    "path": "/v1/me/lottery-attempts",
    "method": "GET",
    "status": 200,
    "schema": "LotteryAttemptPage",
    "sample": {
      "items": [],
      "page": {
        "next_cursor": "演示内容"
      },
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "listOwnLotteryAttempts"
  },
  {
    "path": "/v1/me/lottery-attempts/{attempt_id}",
    "method": "GET",
    "status": 200,
    "schema": "LotteryAttempt",
    "sample": {
      "state": "COMPLETED",
      "result_kind": "WIN",
      "draw_id": "demo-draw",
      "cost_pink_units": "1",
      "prize_code": "DEPOSIT_WAIVER",
      "prize_snapshot": {
        "prize_code": "DEPOSIT_WAIVER",
        "prize_qty": "1",
        "pink_reward_units": "1",
        "coupon_config_version_id": "1"
      },
      "pink_spend_entry_id": "demo-pink_spend_entry",
      "grant_id": "demo-grant",
      "inventory_movement_id": "demo-inventory_movement",
      "balance_after": "1"
    },
    "operation": "getOwnLotteryAttempt"
  },
  {
    "path": "/v1/me/lottery-draws/{draw_id}",
    "method": "GET",
    "status": 200,
    "schema": "LotteryAttempt",
    "sample": {
      "state": "COMPLETED",
      "result_kind": "WIN",
      "draw_id": "demo-draw",
      "cost_pink_units": "1",
      "prize_code": "DEPOSIT_WAIVER",
      "prize_snapshot": {
        "prize_code": "DEPOSIT_WAIVER",
        "prize_qty": "1",
        "pink_reward_units": "1",
        "coupon_config_version_id": "1"
      },
      "pink_spend_entry_id": "demo-pink_spend_entry",
      "grant_id": "demo-grant",
      "inventory_movement_id": "demo-inventory_movement",
      "balance_after": "1"
    },
    "operation": "getOwnLotteryDraw"
  },
  {
    "path": "/v1/me/lottery-intent",
    "method": "GET",
    "status": 200,
    "schema": "LotteryAttempt",
    "sample": {
      "state": "COMPLETED",
      "result_kind": "WIN",
      "draw_id": "demo-draw",
      "cost_pink_units": "1",
      "prize_code": "DEPOSIT_WAIVER",
      "prize_snapshot": {
        "prize_code": "DEPOSIT_WAIVER",
        "prize_qty": "1",
        "pink_reward_units": "1",
        "coupon_config_version_id": "1"
      },
      "pink_spend_entry_id": "demo-pink_spend_entry",
      "grant_id": "demo-grant",
      "inventory_movement_id": "demo-inventory_movement",
      "balance_after": "1"
    },
    "operation": "getOwnLotteryIntent"
  },
  {
    "path": "/v1/me/benefit-grants/{grant_id}",
    "method": "GET",
    "status": 200,
    "schema": "BenefitGrantTrace",
    "sample": {
      "grant_id": "demo-grant",
      "account_id": "demo-account",
      "source_kind": "CHECK_IN",
      "source_id": "demo-source",
      "source_rule_version_id": "1",
      "source_award_ordinal": 1,
      "reward_kind": "POINT",
      "reward_code": "PINK",
      "reward_units": "1",
      "created_at": "2026-10-14T06:00:00Z",
      "coupon_ids": [],
      "pink_entry_ids": []
    },
    "operation": "getOwnBenefitGrant"
  },
  {
    "path": "/v1/me/coupons/{coupon_id}",
    "method": "GET",
    "status": 200,
    "schema": "CouponDetail",
    "sample": {
      "coupon_id": "demo-coupon",
      "account_id": "demo-account",
      "coupon_type": "DEPOSIT_WAIVER",
      "rights_snapshot": {
        "kind": "DEPOSIT_WAIVER",
        "deposit_waiver": "FULL"
      },
      "status": "AVAILABLE",
      "source_grant_id": "demo-source_grant",
      "source_kind": "CHECK_IN",
      "source_id": "demo-source",
      "source_draw_id": "demo-source_draw",
      "coupon_config_version_id": "1",
      "issued_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": {
        "can_redeem": false
      },
      "status_events": [],
      "redemption_id": null,
      "entitlement_lot_id": null,
      "movement_id": null
    },
    "operation": "getOwnCoupon"
  },
  {
    "path": "/v1/me/point-entries/{entry_id}",
    "method": "GET",
    "status": 200,
    "schema": "PointEntryDetail",
    "sample": {
      "entry_id": "demo-entry",
      "account_id": "demo-account",
      "point_kind": "PINK",
      "account_sequence": "1",
      "action": "演示内容",
      "available_delta": "1",
      "available_before": "1",
      "available_after": "1",
      "reserved_after": "1",
      "occurred_at": "2026-10-14T06:00:00Z",
      "source_kind": "演示内容",
      "source_id": "demo-source",
      "source_draw_id": "demo-source_draw",
      "source_grant_id": "demo-source_grant",
      "reserved_delta": "1",
      "earned_delta": "1"
    },
    "operation": "getOwnPointEntry"
  },
  {
    "path": "/v1/me/entitlement-movements/{movement_id}",
    "method": "GET",
    "status": 200,
    "schema": "EntitlementMovementDetail",
    "sample": {
      "movement_id": "demo-movement",
      "account_id": "demo-account",
      "kind": "PUBLISH_QUOTA",
      "account_sequence": "1",
      "lot_id": "demo-lot",
      "action": "演示内容",
      "quantity": "1",
      "available_delta": "1",
      "available_before_qty": "1",
      "available_after_qty": "1",
      "occurred_at": "2026-10-14T06:00:00Z",
      "source_kind": "演示内容",
      "source_id": "demo-source",
      "source_redemption_id": "demo-source_redemption"
    },
    "operation": "getOwnEntitlementMovement"
  },
  {
    "path": "/v1/me/coupon-redemptions/{redemption_id}",
    "method": "GET",
    "status": 200,
    "schema": "CouponRedemptionAttempt",
    "sample": {
      "account_id": "demo-account",
      "attempt_id": "demo-attempt",
      "redemption_id": "demo-redemption",
      "state": "RECEIVED",
      "reason_code": "演示内容",
      "coupon_id": "demo-coupon",
      "quantity": "1",
      "entitlement_lot_id": "demo-entitlement_lot",
      "movement_id": "demo-movement",
      "available_before_qty": "1",
      "available_after_qty": "1",
      "expected_coupon_version": "1",
      "received_at": "2026-10-14T06:00:00Z",
      "resolved_at": "2026-10-14T06:00:00Z",
      "lease_expires_at": "2026-10-14T06:00:00Z",
      "request_id": "demo-request",
      "replayed": false
    },
    "operation": "getOwnCouponRedemption"
  },
  {
    "path": "/v1/me/coupon-redemption-attempts",
    "method": "GET",
    "status": 200,
    "schema": "CouponRedemptionAttemptPage",
    "sample": {
      "items": [],
      "page": {
        "next_cursor": "演示内容"
      },
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "listOwnCouponRedemptionAttempts"
  },
  {
    "path": "/v1/me/coupon-redemption-attempts/{attempt_id}",
    "method": "GET",
    "status": 200,
    "schema": "CouponRedemptionAttempt",
    "sample": {
      "account_id": "demo-account",
      "attempt_id": "demo-attempt",
      "redemption_id": "demo-redemption",
      "state": "RECEIVED",
      "reason_code": "演示内容",
      "coupon_id": "demo-coupon",
      "quantity": "1",
      "entitlement_lot_id": "demo-entitlement_lot",
      "movement_id": "demo-movement",
      "available_before_qty": "1",
      "available_after_qty": "1",
      "expected_coupon_version": "1",
      "received_at": "2026-10-14T06:00:00Z",
      "resolved_at": "2026-10-14T06:00:00Z",
      "lease_expires_at": "2026-10-14T06:00:00Z",
      "request_id": "demo-request",
      "replayed": false
    },
    "operation": "getOwnCouponRedemptionAttempt"
  },
  {
    "path": "/v1/me/coupons/{coupon_id}/redemptions",
    "method": "POST",
    "status": 200,
    "schema": "CouponRedemptionAttempt",
    "sample": {
      "account_id": "demo-account",
      "attempt_id": "demo-attempt",
      "redemption_id": "demo-redemption",
      "state": "RECEIVED",
      "reason_code": "演示内容",
      "coupon_id": "demo-coupon",
      "quantity": "1",
      "entitlement_lot_id": "demo-entitlement_lot",
      "movement_id": "demo-movement",
      "available_before_qty": "1",
      "available_after_qty": "1",
      "expected_coupon_version": "1",
      "received_at": "2026-10-14T06:00:00Z",
      "resolved_at": "2026-10-14T06:00:00Z",
      "lease_expires_at": "2026-10-14T06:00:00Z",
      "request_id": "demo-request",
      "replayed": false
    },
    "operation": "redeemOwnCoupon"
  },
  {
    "path": "/v1/me/coupon-redemption-intent",
    "method": "GET",
    "status": 200,
    "schema": "CouponRedemptionAttempt",
    "sample": {
      "account_id": "demo-account",
      "attempt_id": "demo-attempt",
      "redemption_id": "demo-redemption",
      "state": "RECEIVED",
      "reason_code": "演示内容",
      "coupon_id": "demo-coupon",
      "quantity": "1",
      "entitlement_lot_id": "demo-entitlement_lot",
      "movement_id": "demo-movement",
      "available_before_qty": "1",
      "available_after_qty": "1",
      "expected_coupon_version": "1",
      "received_at": "2026-10-14T06:00:00Z",
      "resolved_at": "2026-10-14T06:00:00Z",
      "lease_expires_at": "2026-10-14T06:00:00Z",
      "request_id": "demo-request",
      "replayed": false
    },
    "operation": "getOwnCouponRedemptionIntent"
  },
  {
    "path": "/v1/me/entitlement-movements",
    "method": "GET",
    "status": 200,
    "schema": "EntitlementMovementPage",
    "sample": {
      "items": [],
      "page": {
        "next_cursor": "演示内容"
      },
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "listOwnEntitlementMovements"
  },
  {
    "path": "/v1/me/check-ins/{check_in_id}",
    "method": "GET",
    "status": 200,
    "schema": "CheckInReceipt",
    "sample": {
      "check_in": {
        "check_in_id": "demo-check_in",
        "business_date": "演示内容",
        "timezone": "演示内容",
        "checked_in_at": "2026-10-14T06:00:00Z",
        "previous_check_in_id": null,
        "streak_days": "1",
        "cumulative_days": "1",
        "rule_version_id": "1"
      },
      "grants": []
    },
    "operation": "getOwnCheckIn"
  },
  {
    "path": "/v1/me/growth-tasks",
    "method": "GET",
    "status": 200,
    "schema": "OwnGrowthTaskList",
    "sample": {
      "enabled": false,
      "disabled_reason": "",
      "rule_version_id": "1",
      "items": [],
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "listOwnGrowthTasks"
  },
  {
    "path": "/v1/me/growth-tasks/{benefit_code}/claims",
    "method": "POST",
    "status": 200,
    "schema": "OwnGrowthTaskClaim",
    "sample": {
      "task": {
        "benefit_code": "演示内容",
        "task_code": "REGISTER",
        "period": "LIFETIME",
        "cycle_key": "演示内容",
        "limit": "1",
        "progress_count": "1",
        "claimed_count": "1",
        "claimable_count": "1",
        "state": "IN_PROGRESS",
        "rewards": []
      },
      "grants": [],
      "replayed": false
    },
    "operation": "claimOwnGrowthTaskReward"
  },
  {
    "path": "/v1/me/rental-quotes",
    "method": "POST",
    "status": 200,
    "schema": "QuoteView",
    "sample": {
      "terms_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "fees": {
        "rent_gross_fen": "1",
        "rent_discount_fen": "1",
        "deposit_list_fen": "1",
        "deposit_waived_fen": "1",
        "deposit_due_fen": "1",
        "initial_due_fen": "1",
        "currency": "CNY"
      },
      "max_payable_fen": "1",
      "required_signer_roles": [
        "TENANT"
      ],
      "blockers": [],
      "requirements": {
        "policy_version_id": "1",
        "allowed_return_methods": [
          "EXPRESS"
        ],
        "outbound_freight_payer": "TENANT",
        "return_freight_payer": "TENANT",
        "freight_included": false,
        "return_instructions": "演示内容",
        "pickup_instructions": "演示内容",
        "media": {
          "photo_bytes_max": "1",
          "video_bytes_max": "1",
          "video_seconds_max": 1,
          "photo_mime_types": [
            "演示内容"
          ],
          "video_mime_types": [
            "演示内容"
          ]
        },
        "return_evidence_template": {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容",
                "url": "演示内容",
                "poster_url": "演示内容"
              }
            }
          ]
        }
      }
    },
    "operation": "B01"
  },
  {
    "path": "/v1/me/rental-orders/preparations",
    "method": "POST",
    "status": 200,
    "schema": "OrderDetail",
    "sample": {
      "server_time": "2026-10-14T06:00:00Z",
      "coupon_status": "RESERVED",
      "order": {
        "payment_mode": "NORMAL",
        "order_id": "demo-order",
        "order_no": "演示内容",
        "viewer_role": "TENANT",
        "supply_channel": "PERSONAL",
        "stage": "PREPARING",
        "physical_status": "NOT_DELIVERED",
        "review_status": "NOT_STARTED",
        "display_status": "演示内容",
        "has_exception": false,
        "exception_codes": [],
        "asset": {
          "asset_id": "demo-asset",
          "asset_revision_id": "demo-asset_revision",
          "title": "演示资料",
          "cover_material_id": "demo-cover_material",
          "cover_media": {
            "material_id": "demo-material",
            "role": "COVER",
            "sort_order": 0,
            "url": "演示内容",
            "mime_type": "演示内容",
            "size_bytes": 1,
            "metadata": {
              "schema_version": 1,
              "width": 1,
              "height": 1,
              "duration_ms": 1,
              "video_codec": "演示内容",
              "audio_codec": "演示内容"
            },
            "poster": {
              "material_id": "demo-material",
              "url": "演示内容",
              "width": 1,
              "height": 1
            }
          }
        },
        "rental_start_at": "2026-10-14T06:00:00Z",
        "rental_end_at": "2026-10-14T06:00:00Z",
        "placed_at": "2026-10-14T06:00:00Z",
        "created_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "display_status_code": "PREPARING",
        "initial_due_fen": "1",
        "initial_paid_fen": "1",
        "supplement_due_fen": "1",
        "payment_due_at": "2026-10-14T06:00:00Z",
        "initial_payer_total_fen": "1"
      },
      "fees": {
        "rent_gross_fen": "1",
        "rent_discount_fen": "1",
        "deposit_list_fen": "1",
        "deposit_waived_fen": "1",
        "deposit_due_fen": "1",
        "initial_due_fen": "1",
        "currency": "CNY"
      },
      "bill": {
        "payment_mode": "NORMAL",
        "finalized": false,
        "review_id": "demo-review",
        "deposit_received_fen": "1",
        "overtime_fen": "1",
        "loss_fen": "1",
        "deducted_fen": "1",
        "refund_due_fen": "1",
        "supplement_due_fen": "1",
        "deposit_refunded_fen": "1",
        "initial_payment": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "supplement_id": "demo-supplement",
          "generation": 0,
          "payment_id": "demo-payment",
          "order_id": "demo-order",
          "purpose": "INITIAL",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_total_fen": "1",
          "currency": "CNY",
          "expires_at": "2026-10-14T06:00:00Z",
          "paid_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "created_at": "2026-10-14T06:00:00Z"
        },
        "supplement": {
          "supplement_id": "demo-supplement",
          "order_id": "demo-order",
          "final_review_id": "demo-final_review",
          "amount_fen": "1",
          "currency": "CNY",
          "status": "UNPAID",
          "active_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_at": "2026-10-14T06:00:00Z",
          "version": "1"
        },
        "refund_summary": {
          "obligation_fen": "1",
          "refunded_fen": "1",
          "pending_fen": "1",
          "open_obligation_count": 0,
          "latest_refund": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "obligation_id": "demo-obligation",
            "original_payment_id": "demo-original_payment",
            "excess_component_fen": "1",
            "refund_id": "demo-refund",
            "order_id": "demo-order",
            "purpose": "DEPOSIT",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_refund_fen": "1",
            "deposit_component_fen": "1",
            "rent_component_fen": "1",
            "refunded_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "currency": "CNY"
          }
        },
        "funds_summary": {
          "gross_received_fen": "1",
          "refunded_fen": "1",
          "net_received_fen": "1",
          "payer_total_fen": "1",
          "payer_refund_fen": "1",
          "payer_net_fen": "1",
          "excess_received_fen": "1",
          "currency": "CNY"
        },
        "assessment": {
          "review_id": "demo-review",
          "review_no": "1",
          "decision": "APPROVE_FINAL",
          "rejection_reason": "演示内容",
          "missing_items": [],
          "adjustment_reason": "演示内容",
          "overtime_basis": {
            "end_at": "2026-10-14T06:00:00Z",
            "cutoff_at": "2026-10-14T06:00:00Z",
            "cutoff_source": "RECEIVED",
            "pricing_config_version_id": "1",
            "unit_seconds": 1,
            "billable_units": "1",
            "unit_price_fen": "1",
            "grace_seconds": 0,
            "rounding": "CEIL_UNIT"
          },
          "loss_items": [],
          "evidence_ids": [],
          "created_at": "2026-10-14T06:00:00Z",
          "evidence": []
        },
        "currency": "CNY"
      },
      "delivery": {
        "method": "EXPRESS",
        "recipient": {
          "recipient_name": "演示内容",
          "country_code": "1",
          "phone": "1",
          "region_ids": [
            "演示内容"
          ],
          "region_text": "演示内容",
          "detail": "演示内容",
          "source_id": "demo-source"
        },
        "tracking_no": "演示内容",
        "carrier": "演示内容",
        "shipped_at": "2026-10-14T06:00:00Z",
        "delivered_at": "2026-10-14T06:00:00Z"
      },
      "contract_id": "demo-contract",
      "return_id": "demo-return",
      "merchant_id": "demo-merchant",
      "earning_id": "demo-earning",
      "payment_due_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "completed_at": "2026-10-14T06:00:00Z",
      "closed_at": "2026-10-14T06:00:00Z",
      "close_reason": "PREPARATION_EXPIRED",
      "asset_snapshot": {
        "asset_id": "demo-asset",
        "asset_revision_id": "demo-asset_revision",
        "title": "演示资料",
        "description": "演示内容",
        "condition_description": "演示内容",
        "physical_identifier_display": "演示内容",
        "material_ids": [],
        "accessories": [],
        "media": []
      },
      "requirements": {
        "policy_version_id": "1",
        "allowed_return_methods": [
          "EXPRESS"
        ],
        "outbound_freight_payer": "TENANT",
        "return_freight_payer": "TENANT",
        "freight_included": false,
        "return_instructions": "演示内容",
        "pickup_instructions": "演示内容",
        "media": {
          "photo_bytes_max": "1",
          "video_bytes_max": "1",
          "video_seconds_max": 1,
          "photo_mime_types": [
            "演示内容"
          ],
          "video_mime_types": [
            "演示内容"
          ]
        },
        "return_evidence_template": {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容",
                "url": "演示内容",
                "poster_url": "演示内容"
              }
            }
          ]
        }
      },
      "latest_cabinet_tasks": [],
      "pickup": {
        "cabinet_id": "demo-cabinet",
        "name": "演示资料",
        "address": "演示内容",
        "compartment_id": "demo-compartment",
        "compartment_no": 1,
        "connectivity_status": "ONLINE"
      },
      "checkout": {
        "coupon_id": "demo-coupon"
      }
    },
    "operation": "B02"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/confirm",
    "method": "POST",
    "status": 200,
    "schema": "OrderDetail",
    "sample": {
      "server_time": "2026-10-14T06:00:00Z",
      "coupon_status": "RESERVED",
      "order": {
        "payment_mode": "NORMAL",
        "order_id": "demo-order",
        "order_no": "演示内容",
        "viewer_role": "TENANT",
        "supply_channel": "PERSONAL",
        "stage": "PREPARING",
        "physical_status": "NOT_DELIVERED",
        "review_status": "NOT_STARTED",
        "display_status": "演示内容",
        "has_exception": false,
        "exception_codes": [],
        "asset": {
          "asset_id": "demo-asset",
          "asset_revision_id": "demo-asset_revision",
          "title": "演示资料",
          "cover_material_id": "demo-cover_material",
          "cover_media": {
            "material_id": "demo-material",
            "role": "COVER",
            "sort_order": 0,
            "url": "演示内容",
            "mime_type": "演示内容",
            "size_bytes": 1,
            "metadata": {
              "schema_version": 1,
              "width": 1,
              "height": 1,
              "duration_ms": 1,
              "video_codec": "演示内容",
              "audio_codec": "演示内容"
            },
            "poster": {
              "material_id": "demo-material",
              "url": "演示内容",
              "width": 1,
              "height": 1
            }
          }
        },
        "rental_start_at": "2026-10-14T06:00:00Z",
        "rental_end_at": "2026-10-14T06:00:00Z",
        "placed_at": "2026-10-14T06:00:00Z",
        "created_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "display_status_code": "PREPARING",
        "initial_due_fen": "1",
        "initial_paid_fen": "1",
        "supplement_due_fen": "1",
        "payment_due_at": "2026-10-14T06:00:00Z",
        "initial_payer_total_fen": "1"
      },
      "fees": {
        "rent_gross_fen": "1",
        "rent_discount_fen": "1",
        "deposit_list_fen": "1",
        "deposit_waived_fen": "1",
        "deposit_due_fen": "1",
        "initial_due_fen": "1",
        "currency": "CNY"
      },
      "bill": {
        "payment_mode": "NORMAL",
        "finalized": false,
        "review_id": "demo-review",
        "deposit_received_fen": "1",
        "overtime_fen": "1",
        "loss_fen": "1",
        "deducted_fen": "1",
        "refund_due_fen": "1",
        "supplement_due_fen": "1",
        "deposit_refunded_fen": "1",
        "initial_payment": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "supplement_id": "demo-supplement",
          "generation": 0,
          "payment_id": "demo-payment",
          "order_id": "demo-order",
          "purpose": "INITIAL",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_total_fen": "1",
          "currency": "CNY",
          "expires_at": "2026-10-14T06:00:00Z",
          "paid_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "created_at": "2026-10-14T06:00:00Z"
        },
        "supplement": {
          "supplement_id": "demo-supplement",
          "order_id": "demo-order",
          "final_review_id": "demo-final_review",
          "amount_fen": "1",
          "currency": "CNY",
          "status": "UNPAID",
          "active_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_at": "2026-10-14T06:00:00Z",
          "version": "1"
        },
        "refund_summary": {
          "obligation_fen": "1",
          "refunded_fen": "1",
          "pending_fen": "1",
          "open_obligation_count": 0,
          "latest_refund": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "obligation_id": "demo-obligation",
            "original_payment_id": "demo-original_payment",
            "excess_component_fen": "1",
            "refund_id": "demo-refund",
            "order_id": "demo-order",
            "purpose": "DEPOSIT",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_refund_fen": "1",
            "deposit_component_fen": "1",
            "rent_component_fen": "1",
            "refunded_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "currency": "CNY"
          }
        },
        "funds_summary": {
          "gross_received_fen": "1",
          "refunded_fen": "1",
          "net_received_fen": "1",
          "payer_total_fen": "1",
          "payer_refund_fen": "1",
          "payer_net_fen": "1",
          "excess_received_fen": "1",
          "currency": "CNY"
        },
        "assessment": {
          "review_id": "demo-review",
          "review_no": "1",
          "decision": "APPROVE_FINAL",
          "rejection_reason": "演示内容",
          "missing_items": [],
          "adjustment_reason": "演示内容",
          "overtime_basis": {
            "end_at": "2026-10-14T06:00:00Z",
            "cutoff_at": "2026-10-14T06:00:00Z",
            "cutoff_source": "RECEIVED",
            "pricing_config_version_id": "1",
            "unit_seconds": 1,
            "billable_units": "1",
            "unit_price_fen": "1",
            "grace_seconds": 0,
            "rounding": "CEIL_UNIT"
          },
          "loss_items": [],
          "evidence_ids": [],
          "created_at": "2026-10-14T06:00:00Z",
          "evidence": []
        },
        "currency": "CNY"
      },
      "delivery": {
        "method": "EXPRESS",
        "recipient": {
          "recipient_name": "演示内容",
          "country_code": "1",
          "phone": "1",
          "region_ids": [
            "演示内容"
          ],
          "region_text": "演示内容",
          "detail": "演示内容",
          "source_id": "demo-source"
        },
        "tracking_no": "演示内容",
        "carrier": "演示内容",
        "shipped_at": "2026-10-14T06:00:00Z",
        "delivered_at": "2026-10-14T06:00:00Z"
      },
      "contract_id": "demo-contract",
      "return_id": "demo-return",
      "merchant_id": "demo-merchant",
      "earning_id": "demo-earning",
      "payment_due_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "completed_at": "2026-10-14T06:00:00Z",
      "closed_at": "2026-10-14T06:00:00Z",
      "close_reason": "PREPARATION_EXPIRED",
      "asset_snapshot": {
        "asset_id": "demo-asset",
        "asset_revision_id": "demo-asset_revision",
        "title": "演示资料",
        "description": "演示内容",
        "condition_description": "演示内容",
        "physical_identifier_display": "演示内容",
        "material_ids": [],
        "accessories": [],
        "media": []
      },
      "requirements": {
        "policy_version_id": "1",
        "allowed_return_methods": [
          "EXPRESS"
        ],
        "outbound_freight_payer": "TENANT",
        "return_freight_payer": "TENANT",
        "freight_included": false,
        "return_instructions": "演示内容",
        "pickup_instructions": "演示内容",
        "media": {
          "photo_bytes_max": "1",
          "video_bytes_max": "1",
          "video_seconds_max": 1,
          "photo_mime_types": [
            "演示内容"
          ],
          "video_mime_types": [
            "演示内容"
          ]
        },
        "return_evidence_template": {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容",
                "url": "演示内容",
                "poster_url": "演示内容"
              }
            }
          ]
        }
      },
      "latest_cabinet_tasks": [],
      "pickup": {
        "cabinet_id": "demo-cabinet",
        "name": "演示资料",
        "address": "演示内容",
        "compartment_id": "demo-compartment",
        "compartment_no": 1,
        "connectivity_status": "ONLINE"
      },
      "checkout": {
        "coupon_id": "demo-coupon"
      }
    },
    "operation": "B03"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/payments",
    "method": "GET",
    "status": 200,
    "schema": "PaymentHistoryPage",
    "sample": {
      "items": [],
      "next_cursor": "演示内容",
      "has_more": false
    },
    "operation": "ListOwnOrderPaymentHistory"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/payments",
    "method": "POST",
    "status": 200,
    "schema": "PaymentView",
    "sample": {
      "payment_mode": "NORMAL",
      "business_amount_fen": "1",
      "channel_amount_fen": "1",
      "supplement_id": "demo-supplement",
      "generation": 0,
      "payment_id": "demo-payment",
      "order_id": "demo-order",
      "purpose": "INITIAL",
      "status": "CREATED",
      "amount_fen": "1",
      "payer_total_fen": "1",
      "currency": "CNY",
      "expires_at": "2026-10-14T06:00:00Z",
      "paid_at": "2026-10-14T06:00:00Z",
      "last_verified_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "created_at": "2026-10-14T06:00:00Z"
    },
    "operation": "B04"
  },
  {
    "path": "/v1/me/rental-payments/{payment_id}/invocation",
    "method": "POST",
    "status": 200,
    "schema": "Invocation",
    "sample": {
      "payment_id": "demo-payment",
      "app_id": "demo-app",
      "time_stamp": "1",
      "nonce_str": "演示内容",
      "package": "演示内容",
      "sign_type": "RSA",
      "pay_sign": "演示内容",
      "expires_at": "2026-10-14T06:00:00Z"
    },
    "operation": "B05"
  },
  {
    "path": "/v1/me/rental-payments/{payment_id}",
    "method": "GET",
    "status": 200,
    "schema": "PaymentView",
    "sample": {
      "payment_mode": "NORMAL",
      "business_amount_fen": "1",
      "channel_amount_fen": "1",
      "supplement_id": "demo-supplement",
      "generation": 0,
      "payment_id": "demo-payment",
      "order_id": "demo-order",
      "purpose": "INITIAL",
      "status": "CREATED",
      "amount_fen": "1",
      "payer_total_fen": "1",
      "currency": "CNY",
      "expires_at": "2026-10-14T06:00:00Z",
      "paid_at": "2026-10-14T06:00:00Z",
      "last_verified_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "created_at": "2026-10-14T06:00:00Z"
    },
    "operation": "B06"
  },
  {
    "path": "/v1/me/rental-payments/{payment_id}/reconciliation",
    "method": "POST",
    "status": 202,
    "schema": "CommandResult",
    "sample": {
      "state": "ACCEPTED",
      "resource_type": "ORDER",
      "resource_id": "demo-resource",
      "order_id": "demo-order",
      "version": "1",
      "poll_after_seconds": 0,
      "allowed_actions": [],
      "blockers": []
    },
    "operation": "B07"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}",
    "method": "GET",
    "status": 200,
    "schema": "OrderDetail",
    "sample": {
      "server_time": "2026-10-14T06:00:00Z",
      "coupon_status": "RESERVED",
      "order": {
        "payment_mode": "NORMAL",
        "order_id": "demo-order",
        "order_no": "演示内容",
        "viewer_role": "TENANT",
        "supply_channel": "PERSONAL",
        "stage": "PREPARING",
        "physical_status": "NOT_DELIVERED",
        "review_status": "NOT_STARTED",
        "display_status": "演示内容",
        "has_exception": false,
        "exception_codes": [],
        "asset": {
          "asset_id": "demo-asset",
          "asset_revision_id": "demo-asset_revision",
          "title": "演示资料",
          "cover_material_id": "demo-cover_material",
          "cover_media": {
            "material_id": "demo-material",
            "role": "COVER",
            "sort_order": 0,
            "url": "演示内容",
            "mime_type": "演示内容",
            "size_bytes": 1,
            "metadata": {
              "schema_version": 1,
              "width": 1,
              "height": 1,
              "duration_ms": 1,
              "video_codec": "演示内容",
              "audio_codec": "演示内容"
            },
            "poster": {
              "material_id": "demo-material",
              "url": "演示内容",
              "width": 1,
              "height": 1
            }
          }
        },
        "rental_start_at": "2026-10-14T06:00:00Z",
        "rental_end_at": "2026-10-14T06:00:00Z",
        "placed_at": "2026-10-14T06:00:00Z",
        "created_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "display_status_code": "PREPARING",
        "initial_due_fen": "1",
        "initial_paid_fen": "1",
        "supplement_due_fen": "1",
        "payment_due_at": "2026-10-14T06:00:00Z",
        "initial_payer_total_fen": "1"
      },
      "fees": {
        "rent_gross_fen": "1",
        "rent_discount_fen": "1",
        "deposit_list_fen": "1",
        "deposit_waived_fen": "1",
        "deposit_due_fen": "1",
        "initial_due_fen": "1",
        "currency": "CNY"
      },
      "bill": {
        "payment_mode": "NORMAL",
        "finalized": false,
        "review_id": "demo-review",
        "deposit_received_fen": "1",
        "overtime_fen": "1",
        "loss_fen": "1",
        "deducted_fen": "1",
        "refund_due_fen": "1",
        "supplement_due_fen": "1",
        "deposit_refunded_fen": "1",
        "initial_payment": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "supplement_id": "demo-supplement",
          "generation": 0,
          "payment_id": "demo-payment",
          "order_id": "demo-order",
          "purpose": "INITIAL",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_total_fen": "1",
          "currency": "CNY",
          "expires_at": "2026-10-14T06:00:00Z",
          "paid_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "created_at": "2026-10-14T06:00:00Z"
        },
        "supplement": {
          "supplement_id": "demo-supplement",
          "order_id": "demo-order",
          "final_review_id": "demo-final_review",
          "amount_fen": "1",
          "currency": "CNY",
          "status": "UNPAID",
          "active_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_at": "2026-10-14T06:00:00Z",
          "version": "1"
        },
        "refund_summary": {
          "obligation_fen": "1",
          "refunded_fen": "1",
          "pending_fen": "1",
          "open_obligation_count": 0,
          "latest_refund": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "obligation_id": "demo-obligation",
            "original_payment_id": "demo-original_payment",
            "excess_component_fen": "1",
            "refund_id": "demo-refund",
            "order_id": "demo-order",
            "purpose": "DEPOSIT",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_refund_fen": "1",
            "deposit_component_fen": "1",
            "rent_component_fen": "1",
            "refunded_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "currency": "CNY"
          }
        },
        "funds_summary": {
          "gross_received_fen": "1",
          "refunded_fen": "1",
          "net_received_fen": "1",
          "payer_total_fen": "1",
          "payer_refund_fen": "1",
          "payer_net_fen": "1",
          "excess_received_fen": "1",
          "currency": "CNY"
        },
        "assessment": {
          "review_id": "demo-review",
          "review_no": "1",
          "decision": "APPROVE_FINAL",
          "rejection_reason": "演示内容",
          "missing_items": [],
          "adjustment_reason": "演示内容",
          "overtime_basis": {
            "end_at": "2026-10-14T06:00:00Z",
            "cutoff_at": "2026-10-14T06:00:00Z",
            "cutoff_source": "RECEIVED",
            "pricing_config_version_id": "1",
            "unit_seconds": 1,
            "billable_units": "1",
            "unit_price_fen": "1",
            "grace_seconds": 0,
            "rounding": "CEIL_UNIT"
          },
          "loss_items": [],
          "evidence_ids": [],
          "created_at": "2026-10-14T06:00:00Z",
          "evidence": []
        },
        "currency": "CNY"
      },
      "delivery": {
        "method": "EXPRESS",
        "recipient": {
          "recipient_name": "演示内容",
          "country_code": "1",
          "phone": "1",
          "region_ids": [
            "演示内容"
          ],
          "region_text": "演示内容",
          "detail": "演示内容",
          "source_id": "demo-source"
        },
        "tracking_no": "演示内容",
        "carrier": "演示内容",
        "shipped_at": "2026-10-14T06:00:00Z",
        "delivered_at": "2026-10-14T06:00:00Z"
      },
      "contract_id": "demo-contract",
      "return_id": "demo-return",
      "merchant_id": "demo-merchant",
      "earning_id": "demo-earning",
      "payment_due_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "completed_at": "2026-10-14T06:00:00Z",
      "closed_at": "2026-10-14T06:00:00Z",
      "close_reason": "PREPARATION_EXPIRED",
      "asset_snapshot": {
        "asset_id": "demo-asset",
        "asset_revision_id": "demo-asset_revision",
        "title": "演示资料",
        "description": "演示内容",
        "condition_description": "演示内容",
        "physical_identifier_display": "演示内容",
        "material_ids": [],
        "accessories": [],
        "media": []
      },
      "requirements": {
        "policy_version_id": "1",
        "allowed_return_methods": [
          "EXPRESS"
        ],
        "outbound_freight_payer": "TENANT",
        "return_freight_payer": "TENANT",
        "freight_included": false,
        "return_instructions": "演示内容",
        "pickup_instructions": "演示内容",
        "media": {
          "photo_bytes_max": "1",
          "video_bytes_max": "1",
          "video_seconds_max": 1,
          "photo_mime_types": [
            "演示内容"
          ],
          "video_mime_types": [
            "演示内容"
          ]
        },
        "return_evidence_template": {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容",
                "url": "演示内容",
                "poster_url": "演示内容"
              }
            }
          ]
        }
      },
      "latest_cabinet_tasks": [],
      "pickup": {
        "cabinet_id": "demo-cabinet",
        "name": "演示资料",
        "address": "演示内容",
        "compartment_id": "demo-compartment",
        "compartment_no": 1,
        "connectivity_status": "ONLINE"
      },
      "checkout": {
        "coupon_id": "demo-coupon"
      }
    },
    "operation": "B08"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/cancel-unpaid",
    "method": "POST",
    "status": 202,
    "schema": "CommandResult",
    "sample": {
      "state": "ACCEPTED",
      "resource_type": "ORDER",
      "resource_id": "demo-resource",
      "order_id": "demo-order",
      "version": "1",
      "poll_after_seconds": 0,
      "allowed_actions": [],
      "blockers": []
    },
    "operation": "B09"
  },
  {
    "path": "/v1/me/rental-orders",
    "method": "GET",
    "status": 200,
    "schema": "OrderPage",
    "sample": {
      "items": [],
      "next_cursor": "演示内容",
      "has_more": false
    },
    "operation": "Q01"
  },
  {
    "path": "/v1/me/rental-refunds/{refund_id}",
    "method": "GET",
    "status": 200,
    "schema": "RefundView",
    "sample": {
      "payment_mode": "NORMAL",
      "business_amount_fen": "1",
      "channel_amount_fen": "1",
      "obligation_id": "demo-obligation",
      "original_payment_id": "demo-original_payment",
      "excess_component_fen": "1",
      "refund_id": "demo-refund",
      "order_id": "demo-order",
      "purpose": "DEPOSIT",
      "status": "CREATED",
      "amount_fen": "1",
      "payer_refund_fen": "1",
      "deposit_component_fen": "1",
      "rent_component_fen": "1",
      "refunded_at": "2026-10-14T06:00:00Z",
      "last_verified_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "currency": "CNY"
    },
    "operation": "Q04"
  },
  {
    "path": "/v1/me/rental-refunds/{refund_id}/reconciliation",
    "method": "POST",
    "status": 202,
    "schema": "CommandResult",
    "sample": {
      "state": "ACCEPTED",
      "resource_type": "ORDER",
      "resource_id": "demo-resource",
      "order_id": "demo-order",
      "version": "1",
      "poll_after_seconds": 0,
      "allowed_actions": [],
      "blockers": []
    },
    "operation": "Q05"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/contract",
    "method": "GET",
    "status": 200,
    "schema": "ContractView",
    "sample": {
      "contract_id": "demo-contract",
      "order_id": "demo-order",
      "status": "PENDING",
      "template_version_id": "1",
      "document_template": {
        "template_version_id": "1",
        "source_docx_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "lessor_signature": {
        "name": "演示资料",
        "mode": "DEFAULT_SIGNED",
        "source": "USER_CONFIRMED_LOCAL_DEFAULT",
        "presignature_id": null,
        "material_id": null,
        "signed_at": null
      },
      "tenant_signature": {
        "name": "演示资料",
        "account_id": "demo-account",
        "status": "PENDING",
        "signed_at": "2026-10-14T06:00:00Z"
      },
      "current_attempt": {
        "attempt_id": "demo-attempt",
        "client_signature_id": "demo-client_signature",
        "status": "BUILDING",
        "version": "1",
        "preview_artifact_id": "demo-preview_artifact",
        "preview_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "error_code": "演示内容",
        "allowed_actions": [],
        "expires_at": "2026-10-14T06:00:00Z",
        "confirmed_at": "2026-10-14T06:00:00Z"
      },
      "final_artifact": {
        "artifact_id": "demo-artifact",
        "document_material_id": "demo-document_material",
        "document_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "document_url": "演示内容",
        "page_count": 1,
        "pages": [
          {
            "page_no": 1,
            "material_id": "demo-material",
            "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "url": "演示内容"
          }
        ],
        "anchor_snapshot_json": [
          {
            "role": "TENANT_MAIN",
            "page_no": 1,
            "x": 0,
            "y": 0,
            "w": 1,
            "h": 1
          }
        ],
        "renderer_version": "1"
      },
      "quota_state": "NOT_APPLICABLE",
      "quota_valid_until": "2026-10-14T06:00:00Z",
      "expires_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "agreement_text": "演示内容",
      "agreement_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "order_terms_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    "operation": "C01N"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/shipment",
    "method": "POST",
    "status": 200,
    "schema": "OrderDetail",
    "sample": {
      "server_time": "2026-10-14T06:00:00Z",
      "coupon_status": "RESERVED",
      "order": {
        "payment_mode": "NORMAL",
        "order_id": "demo-order",
        "order_no": "演示内容",
        "viewer_role": "TENANT",
        "supply_channel": "PERSONAL",
        "stage": "PREPARING",
        "physical_status": "NOT_DELIVERED",
        "review_status": "NOT_STARTED",
        "display_status": "演示内容",
        "has_exception": false,
        "exception_codes": [],
        "asset": {
          "asset_id": "demo-asset",
          "asset_revision_id": "demo-asset_revision",
          "title": "演示资料",
          "cover_material_id": "demo-cover_material",
          "cover_media": {
            "material_id": "demo-material",
            "role": "COVER",
            "sort_order": 0,
            "url": "演示内容",
            "mime_type": "演示内容",
            "size_bytes": 1,
            "metadata": {
              "schema_version": 1,
              "width": 1,
              "height": 1,
              "duration_ms": 1,
              "video_codec": "演示内容",
              "audio_codec": "演示内容"
            },
            "poster": {
              "material_id": "demo-material",
              "url": "演示内容",
              "width": 1,
              "height": 1
            }
          }
        },
        "rental_start_at": "2026-10-14T06:00:00Z",
        "rental_end_at": "2026-10-14T06:00:00Z",
        "placed_at": "2026-10-14T06:00:00Z",
        "created_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "display_status_code": "PREPARING",
        "initial_due_fen": "1",
        "initial_paid_fen": "1",
        "supplement_due_fen": "1",
        "payment_due_at": "2026-10-14T06:00:00Z",
        "initial_payer_total_fen": "1"
      },
      "fees": {
        "rent_gross_fen": "1",
        "rent_discount_fen": "1",
        "deposit_list_fen": "1",
        "deposit_waived_fen": "1",
        "deposit_due_fen": "1",
        "initial_due_fen": "1",
        "currency": "CNY"
      },
      "bill": {
        "payment_mode": "NORMAL",
        "finalized": false,
        "review_id": "demo-review",
        "deposit_received_fen": "1",
        "overtime_fen": "1",
        "loss_fen": "1",
        "deducted_fen": "1",
        "refund_due_fen": "1",
        "supplement_due_fen": "1",
        "deposit_refunded_fen": "1",
        "initial_payment": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "supplement_id": "demo-supplement",
          "generation": 0,
          "payment_id": "demo-payment",
          "order_id": "demo-order",
          "purpose": "INITIAL",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_total_fen": "1",
          "currency": "CNY",
          "expires_at": "2026-10-14T06:00:00Z",
          "paid_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "created_at": "2026-10-14T06:00:00Z"
        },
        "supplement": {
          "supplement_id": "demo-supplement",
          "order_id": "demo-order",
          "final_review_id": "demo-final_review",
          "amount_fen": "1",
          "currency": "CNY",
          "status": "UNPAID",
          "active_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_at": "2026-10-14T06:00:00Z",
          "version": "1"
        },
        "refund_summary": {
          "obligation_fen": "1",
          "refunded_fen": "1",
          "pending_fen": "1",
          "open_obligation_count": 0,
          "latest_refund": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "obligation_id": "demo-obligation",
            "original_payment_id": "demo-original_payment",
            "excess_component_fen": "1",
            "refund_id": "demo-refund",
            "order_id": "demo-order",
            "purpose": "DEPOSIT",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_refund_fen": "1",
            "deposit_component_fen": "1",
            "rent_component_fen": "1",
            "refunded_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "currency": "CNY"
          }
        },
        "funds_summary": {
          "gross_received_fen": "1",
          "refunded_fen": "1",
          "net_received_fen": "1",
          "payer_total_fen": "1",
          "payer_refund_fen": "1",
          "payer_net_fen": "1",
          "excess_received_fen": "1",
          "currency": "CNY"
        },
        "assessment": {
          "review_id": "demo-review",
          "review_no": "1",
          "decision": "APPROVE_FINAL",
          "rejection_reason": "演示内容",
          "missing_items": [],
          "adjustment_reason": "演示内容",
          "overtime_basis": {
            "end_at": "2026-10-14T06:00:00Z",
            "cutoff_at": "2026-10-14T06:00:00Z",
            "cutoff_source": "RECEIVED",
            "pricing_config_version_id": "1",
            "unit_seconds": 1,
            "billable_units": "1",
            "unit_price_fen": "1",
            "grace_seconds": 0,
            "rounding": "CEIL_UNIT"
          },
          "loss_items": [],
          "evidence_ids": [],
          "created_at": "2026-10-14T06:00:00Z",
          "evidence": []
        },
        "currency": "CNY"
      },
      "delivery": {
        "method": "EXPRESS",
        "recipient": {
          "recipient_name": "演示内容",
          "country_code": "1",
          "phone": "1",
          "region_ids": [
            "演示内容"
          ],
          "region_text": "演示内容",
          "detail": "演示内容",
          "source_id": "demo-source"
        },
        "tracking_no": "演示内容",
        "carrier": "演示内容",
        "shipped_at": "2026-10-14T06:00:00Z",
        "delivered_at": "2026-10-14T06:00:00Z"
      },
      "contract_id": "demo-contract",
      "return_id": "demo-return",
      "merchant_id": "demo-merchant",
      "earning_id": "demo-earning",
      "payment_due_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "completed_at": "2026-10-14T06:00:00Z",
      "closed_at": "2026-10-14T06:00:00Z",
      "close_reason": "PREPARATION_EXPIRED",
      "asset_snapshot": {
        "asset_id": "demo-asset",
        "asset_revision_id": "demo-asset_revision",
        "title": "演示资料",
        "description": "演示内容",
        "condition_description": "演示内容",
        "physical_identifier_display": "演示内容",
        "material_ids": [],
        "accessories": [],
        "media": []
      },
      "requirements": {
        "policy_version_id": "1",
        "allowed_return_methods": [
          "EXPRESS"
        ],
        "outbound_freight_payer": "TENANT",
        "return_freight_payer": "TENANT",
        "freight_included": false,
        "return_instructions": "演示内容",
        "pickup_instructions": "演示内容",
        "media": {
          "photo_bytes_max": "1",
          "video_bytes_max": "1",
          "video_seconds_max": 1,
          "photo_mime_types": [
            "演示内容"
          ],
          "video_mime_types": [
            "演示内容"
          ]
        },
        "return_evidence_template": {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容",
                "url": "演示内容",
                "poster_url": "演示内容"
              }
            }
          ]
        }
      },
      "latest_cabinet_tasks": [],
      "pickup": {
        "cabinet_id": "demo-cabinet",
        "name": "演示资料",
        "address": "演示内容",
        "compartment_id": "demo-compartment",
        "compartment_no": 1,
        "connectivity_status": "ONLINE"
      },
      "checkout": {
        "coupon_id": "demo-coupon"
      }
    },
    "operation": "F01"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/shipment/corrections",
    "method": "POST",
    "status": 200,
    "schema": "OrderDetail",
    "sample": {
      "server_time": "2026-10-14T06:00:00Z",
      "coupon_status": "RESERVED",
      "order": {
        "payment_mode": "NORMAL",
        "order_id": "demo-order",
        "order_no": "演示内容",
        "viewer_role": "TENANT",
        "supply_channel": "PERSONAL",
        "stage": "PREPARING",
        "physical_status": "NOT_DELIVERED",
        "review_status": "NOT_STARTED",
        "display_status": "演示内容",
        "has_exception": false,
        "exception_codes": [],
        "asset": {
          "asset_id": "demo-asset",
          "asset_revision_id": "demo-asset_revision",
          "title": "演示资料",
          "cover_material_id": "demo-cover_material",
          "cover_media": {
            "material_id": "demo-material",
            "role": "COVER",
            "sort_order": 0,
            "url": "演示内容",
            "mime_type": "演示内容",
            "size_bytes": 1,
            "metadata": {
              "schema_version": 1,
              "width": 1,
              "height": 1,
              "duration_ms": 1,
              "video_codec": "演示内容",
              "audio_codec": "演示内容"
            },
            "poster": {
              "material_id": "demo-material",
              "url": "演示内容",
              "width": 1,
              "height": 1
            }
          }
        },
        "rental_start_at": "2026-10-14T06:00:00Z",
        "rental_end_at": "2026-10-14T06:00:00Z",
        "placed_at": "2026-10-14T06:00:00Z",
        "created_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "display_status_code": "PREPARING",
        "initial_due_fen": "1",
        "initial_paid_fen": "1",
        "supplement_due_fen": "1",
        "payment_due_at": "2026-10-14T06:00:00Z",
        "initial_payer_total_fen": "1"
      },
      "fees": {
        "rent_gross_fen": "1",
        "rent_discount_fen": "1",
        "deposit_list_fen": "1",
        "deposit_waived_fen": "1",
        "deposit_due_fen": "1",
        "initial_due_fen": "1",
        "currency": "CNY"
      },
      "bill": {
        "payment_mode": "NORMAL",
        "finalized": false,
        "review_id": "demo-review",
        "deposit_received_fen": "1",
        "overtime_fen": "1",
        "loss_fen": "1",
        "deducted_fen": "1",
        "refund_due_fen": "1",
        "supplement_due_fen": "1",
        "deposit_refunded_fen": "1",
        "initial_payment": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "supplement_id": "demo-supplement",
          "generation": 0,
          "payment_id": "demo-payment",
          "order_id": "demo-order",
          "purpose": "INITIAL",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_total_fen": "1",
          "currency": "CNY",
          "expires_at": "2026-10-14T06:00:00Z",
          "paid_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "created_at": "2026-10-14T06:00:00Z"
        },
        "supplement": {
          "supplement_id": "demo-supplement",
          "order_id": "demo-order",
          "final_review_id": "demo-final_review",
          "amount_fen": "1",
          "currency": "CNY",
          "status": "UNPAID",
          "active_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_at": "2026-10-14T06:00:00Z",
          "version": "1"
        },
        "refund_summary": {
          "obligation_fen": "1",
          "refunded_fen": "1",
          "pending_fen": "1",
          "open_obligation_count": 0,
          "latest_refund": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "obligation_id": "demo-obligation",
            "original_payment_id": "demo-original_payment",
            "excess_component_fen": "1",
            "refund_id": "demo-refund",
            "order_id": "demo-order",
            "purpose": "DEPOSIT",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_refund_fen": "1",
            "deposit_component_fen": "1",
            "rent_component_fen": "1",
            "refunded_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "currency": "CNY"
          }
        },
        "funds_summary": {
          "gross_received_fen": "1",
          "refunded_fen": "1",
          "net_received_fen": "1",
          "payer_total_fen": "1",
          "payer_refund_fen": "1",
          "payer_net_fen": "1",
          "excess_received_fen": "1",
          "currency": "CNY"
        },
        "assessment": {
          "review_id": "demo-review",
          "review_no": "1",
          "decision": "APPROVE_FINAL",
          "rejection_reason": "演示内容",
          "missing_items": [],
          "adjustment_reason": "演示内容",
          "overtime_basis": {
            "end_at": "2026-10-14T06:00:00Z",
            "cutoff_at": "2026-10-14T06:00:00Z",
            "cutoff_source": "RECEIVED",
            "pricing_config_version_id": "1",
            "unit_seconds": 1,
            "billable_units": "1",
            "unit_price_fen": "1",
            "grace_seconds": 0,
            "rounding": "CEIL_UNIT"
          },
          "loss_items": [],
          "evidence_ids": [],
          "created_at": "2026-10-14T06:00:00Z",
          "evidence": []
        },
        "currency": "CNY"
      },
      "delivery": {
        "method": "EXPRESS",
        "recipient": {
          "recipient_name": "演示内容",
          "country_code": "1",
          "phone": "1",
          "region_ids": [
            "演示内容"
          ],
          "region_text": "演示内容",
          "detail": "演示内容",
          "source_id": "demo-source"
        },
        "tracking_no": "演示内容",
        "carrier": "演示内容",
        "shipped_at": "2026-10-14T06:00:00Z",
        "delivered_at": "2026-10-14T06:00:00Z"
      },
      "contract_id": "demo-contract",
      "return_id": "demo-return",
      "merchant_id": "demo-merchant",
      "earning_id": "demo-earning",
      "payment_due_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "completed_at": "2026-10-14T06:00:00Z",
      "closed_at": "2026-10-14T06:00:00Z",
      "close_reason": "PREPARATION_EXPIRED",
      "asset_snapshot": {
        "asset_id": "demo-asset",
        "asset_revision_id": "demo-asset_revision",
        "title": "演示资料",
        "description": "演示内容",
        "condition_description": "演示内容",
        "physical_identifier_display": "演示内容",
        "material_ids": [],
        "accessories": [],
        "media": []
      },
      "requirements": {
        "policy_version_id": "1",
        "allowed_return_methods": [
          "EXPRESS"
        ],
        "outbound_freight_payer": "TENANT",
        "return_freight_payer": "TENANT",
        "freight_included": false,
        "return_instructions": "演示内容",
        "pickup_instructions": "演示内容",
        "media": {
          "photo_bytes_max": "1",
          "video_bytes_max": "1",
          "video_seconds_max": 1,
          "photo_mime_types": [
            "演示内容"
          ],
          "video_mime_types": [
            "演示内容"
          ]
        },
        "return_evidence_template": {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容",
                "url": "演示内容",
                "poster_url": "演示内容"
              }
            }
          ]
        }
      },
      "latest_cabinet_tasks": [],
      "pickup": {
        "cabinet_id": "demo-cabinet",
        "name": "演示资料",
        "address": "演示内容",
        "compartment_id": "demo-compartment",
        "compartment_no": 1,
        "connectivity_status": "ONLINE"
      },
      "checkout": {
        "coupon_id": "demo-coupon"
      }
    },
    "operation": "F03"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/delivery-confirmations",
    "method": "POST",
    "status": 200,
    "schema": "OrderDetail",
    "sample": {
      "server_time": "2026-10-14T06:00:00Z",
      "coupon_status": "RESERVED",
      "order": {
        "payment_mode": "NORMAL",
        "order_id": "demo-order",
        "order_no": "演示内容",
        "viewer_role": "TENANT",
        "supply_channel": "PERSONAL",
        "stage": "PREPARING",
        "physical_status": "NOT_DELIVERED",
        "review_status": "NOT_STARTED",
        "display_status": "演示内容",
        "has_exception": false,
        "exception_codes": [],
        "asset": {
          "asset_id": "demo-asset",
          "asset_revision_id": "demo-asset_revision",
          "title": "演示资料",
          "cover_material_id": "demo-cover_material",
          "cover_media": {
            "material_id": "demo-material",
            "role": "COVER",
            "sort_order": 0,
            "url": "演示内容",
            "mime_type": "演示内容",
            "size_bytes": 1,
            "metadata": {
              "schema_version": 1,
              "width": 1,
              "height": 1,
              "duration_ms": 1,
              "video_codec": "演示内容",
              "audio_codec": "演示内容"
            },
            "poster": {
              "material_id": "demo-material",
              "url": "演示内容",
              "width": 1,
              "height": 1
            }
          }
        },
        "rental_start_at": "2026-10-14T06:00:00Z",
        "rental_end_at": "2026-10-14T06:00:00Z",
        "placed_at": "2026-10-14T06:00:00Z",
        "created_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "display_status_code": "PREPARING",
        "initial_due_fen": "1",
        "initial_paid_fen": "1",
        "supplement_due_fen": "1",
        "payment_due_at": "2026-10-14T06:00:00Z",
        "initial_payer_total_fen": "1"
      },
      "fees": {
        "rent_gross_fen": "1",
        "rent_discount_fen": "1",
        "deposit_list_fen": "1",
        "deposit_waived_fen": "1",
        "deposit_due_fen": "1",
        "initial_due_fen": "1",
        "currency": "CNY"
      },
      "bill": {
        "payment_mode": "NORMAL",
        "finalized": false,
        "review_id": "demo-review",
        "deposit_received_fen": "1",
        "overtime_fen": "1",
        "loss_fen": "1",
        "deducted_fen": "1",
        "refund_due_fen": "1",
        "supplement_due_fen": "1",
        "deposit_refunded_fen": "1",
        "initial_payment": {
          "payment_mode": "NORMAL",
          "business_amount_fen": "1",
          "channel_amount_fen": "1",
          "supplement_id": "demo-supplement",
          "generation": 0,
          "payment_id": "demo-payment",
          "order_id": "demo-order",
          "purpose": "INITIAL",
          "status": "CREATED",
          "amount_fen": "1",
          "payer_total_fen": "1",
          "currency": "CNY",
          "expires_at": "2026-10-14T06:00:00Z",
          "paid_at": "2026-10-14T06:00:00Z",
          "last_verified_at": "2026-10-14T06:00:00Z",
          "version": "1",
          "allowed_actions": [],
          "blockers": [],
          "created_at": "2026-10-14T06:00:00Z"
        },
        "supplement": {
          "supplement_id": "demo-supplement",
          "order_id": "demo-order",
          "final_review_id": "demo-final_review",
          "amount_fen": "1",
          "currency": "CNY",
          "status": "UNPAID",
          "active_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_payment": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "supplement_id": "demo-supplement",
            "generation": 0,
            "payment_id": "demo-payment",
            "order_id": "demo-order",
            "purpose": "INITIAL",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_total_fen": "1",
            "currency": "CNY",
            "expires_at": "2026-10-14T06:00:00Z",
            "paid_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "created_at": "2026-10-14T06:00:00Z"
          },
          "paid_at": "2026-10-14T06:00:00Z",
          "version": "1"
        },
        "refund_summary": {
          "obligation_fen": "1",
          "refunded_fen": "1",
          "pending_fen": "1",
          "open_obligation_count": 0,
          "latest_refund": {
            "payment_mode": "NORMAL",
            "business_amount_fen": "1",
            "channel_amount_fen": "1",
            "obligation_id": "demo-obligation",
            "original_payment_id": "demo-original_payment",
            "excess_component_fen": "1",
            "refund_id": "demo-refund",
            "order_id": "demo-order",
            "purpose": "DEPOSIT",
            "status": "CREATED",
            "amount_fen": "1",
            "payer_refund_fen": "1",
            "deposit_component_fen": "1",
            "rent_component_fen": "1",
            "refunded_at": "2026-10-14T06:00:00Z",
            "last_verified_at": "2026-10-14T06:00:00Z",
            "version": "1",
            "allowed_actions": [],
            "blockers": [],
            "currency": "CNY"
          }
        },
        "funds_summary": {
          "gross_received_fen": "1",
          "refunded_fen": "1",
          "net_received_fen": "1",
          "payer_total_fen": "1",
          "payer_refund_fen": "1",
          "payer_net_fen": "1",
          "excess_received_fen": "1",
          "currency": "CNY"
        },
        "assessment": {
          "review_id": "demo-review",
          "review_no": "1",
          "decision": "APPROVE_FINAL",
          "rejection_reason": "演示内容",
          "missing_items": [],
          "adjustment_reason": "演示内容",
          "overtime_basis": {
            "end_at": "2026-10-14T06:00:00Z",
            "cutoff_at": "2026-10-14T06:00:00Z",
            "cutoff_source": "RECEIVED",
            "pricing_config_version_id": "1",
            "unit_seconds": 1,
            "billable_units": "1",
            "unit_price_fen": "1",
            "grace_seconds": 0,
            "rounding": "CEIL_UNIT"
          },
          "loss_items": [],
          "evidence_ids": [],
          "created_at": "2026-10-14T06:00:00Z",
          "evidence": []
        },
        "currency": "CNY"
      },
      "delivery": {
        "method": "EXPRESS",
        "recipient": {
          "recipient_name": "演示内容",
          "country_code": "1",
          "phone": "1",
          "region_ids": [
            "演示内容"
          ],
          "region_text": "演示内容",
          "detail": "演示内容",
          "source_id": "demo-source"
        },
        "tracking_no": "演示内容",
        "carrier": "演示内容",
        "shipped_at": "2026-10-14T06:00:00Z",
        "delivered_at": "2026-10-14T06:00:00Z"
      },
      "contract_id": "demo-contract",
      "return_id": "demo-return",
      "merchant_id": "demo-merchant",
      "earning_id": "demo-earning",
      "payment_due_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "completed_at": "2026-10-14T06:00:00Z",
      "closed_at": "2026-10-14T06:00:00Z",
      "close_reason": "PREPARATION_EXPIRED",
      "asset_snapshot": {
        "asset_id": "demo-asset",
        "asset_revision_id": "demo-asset_revision",
        "title": "演示资料",
        "description": "演示内容",
        "condition_description": "演示内容",
        "physical_identifier_display": "演示内容",
        "material_ids": [],
        "accessories": [],
        "media": []
      },
      "requirements": {
        "policy_version_id": "1",
        "allowed_return_methods": [
          "EXPRESS"
        ],
        "outbound_freight_payer": "TENANT",
        "return_freight_payer": "TENANT",
        "freight_included": false,
        "return_instructions": "演示内容",
        "pickup_instructions": "演示内容",
        "media": {
          "photo_bytes_max": "1",
          "video_bytes_max": "1",
          "video_seconds_max": 1,
          "photo_mime_types": [
            "演示内容"
          ],
          "video_mime_types": [
            "演示内容"
          ]
        },
        "return_evidence_template": {
          "template_key": "演示内容",
          "version": "1",
          "title": "演示资料",
          "slots": [
            {
              "slot_key": "演示内容",
              "title": "演示资料",
              "kind": "PHOTO",
              "stage": "PRE_RETURN",
              "min_count": 1,
              "max_count": 1,
              "instruction": "演示内容",
              "sort_order": 0,
              "example": {
                "object_key": "演示内容",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "mime_type": "image/jpeg",
                "poster_object_key": "演示内容",
                "url": "演示内容",
                "poster_url": "演示内容"
              }
            }
          ]
        }
      },
      "latest_cabinet_tasks": [],
      "pickup": {
        "cabinet_id": "demo-cabinet",
        "name": "演示资料",
        "address": "演示内容",
        "compartment_id": "demo-compartment",
        "compartment_no": 1,
        "connectivity_status": "ONLINE"
      },
      "checkout": {
        "coupon_id": "demo-coupon"
      }
    },
    "operation": "F05"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/return-draft",
    "method": "POST",
    "status": 200,
    "schema": "ReturnView",
    "sample": {
      "return_id": "demo-return",
      "order_id": "demo-order",
      "method": "EXPRESS",
      "address_version": "1",
      "address": {
        "recipient_name": "演示内容",
        "country_code": "1",
        "phone": "1",
        "region_ids": [
          "演示内容"
        ],
        "region_text": "演示内容",
        "detail": "演示内容",
        "source_id": "demo-source"
      },
      "confirmed_address_version": "1",
      "tracking_no": "演示内容",
      "carrier": "演示内容",
      "shipped_at": "2026-10-14T06:00:00Z",
      "material_status": "INCOMPLETE",
      "submitted_at": "2026-10-14T06:00:00Z",
      "received_at": "2026-10-14T06:00:00Z",
      "receipt_source": "CABINET",
      "receipt_recorded_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "receipt_note": "演示内容",
      "note": "演示内容",
      "evidence_version": "1",
      "evidence_template": {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容",
              "url": "演示内容",
              "poster_url": "演示内容"
            }
          }
        ]
      },
      "evidence_slots": [],
      "evidence_history": [],
      "pre_return_complete": false,
      "cabinet_task": {
        "task_id": "demo-task",
        "order_id": "demo-order",
        "purpose": "PICKUP",
        "cabinet_id": "demo-cabinet",
        "compartment_id": "demo-compartment",
        "status": "RESERVED",
        "door_status": "OPEN",
        "rfid_result": "MATCH",
        "observed_at": "2026-10-14T06:00:00Z",
        "hold_expires_at": "2026-10-14T06:00:00Z",
        "confirmed_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "occupancy_result": "TARGET_PRESENT",
        "pre_open_rfid_result": "MATCH",
        "pre_open_observed_at": "2026-10-14T06:00:00Z",
        "verification_requested_at": "2026-10-14T06:00:00Z",
        "cabinet_name": "演示内容",
        "compartment_no": "1"
      },
      "missing_items": []
    },
    "operation": "R01"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/return",
    "method": "GET",
    "status": 200,
    "schema": "ReturnView",
    "sample": {
      "return_id": "demo-return",
      "order_id": "demo-order",
      "method": "EXPRESS",
      "address_version": "1",
      "address": {
        "recipient_name": "演示内容",
        "country_code": "1",
        "phone": "1",
        "region_ids": [
          "演示内容"
        ],
        "region_text": "演示内容",
        "detail": "演示内容",
        "source_id": "demo-source"
      },
      "confirmed_address_version": "1",
      "tracking_no": "演示内容",
      "carrier": "演示内容",
      "shipped_at": "2026-10-14T06:00:00Z",
      "material_status": "INCOMPLETE",
      "submitted_at": "2026-10-14T06:00:00Z",
      "received_at": "2026-10-14T06:00:00Z",
      "receipt_source": "CABINET",
      "receipt_recorded_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "receipt_note": "演示内容",
      "note": "演示内容",
      "evidence_version": "1",
      "evidence_template": {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容",
              "url": "演示内容",
              "poster_url": "演示内容"
            }
          }
        ]
      },
      "evidence_slots": [],
      "evidence_history": [],
      "pre_return_complete": false,
      "cabinet_task": {
        "task_id": "demo-task",
        "order_id": "demo-order",
        "purpose": "PICKUP",
        "cabinet_id": "demo-cabinet",
        "compartment_id": "demo-compartment",
        "status": "RESERVED",
        "door_status": "OPEN",
        "rfid_result": "MATCH",
        "observed_at": "2026-10-14T06:00:00Z",
        "hold_expires_at": "2026-10-14T06:00:00Z",
        "confirmed_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "occupancy_result": "TARGET_PRESENT",
        "pre_open_rfid_result": "MATCH",
        "pre_open_observed_at": "2026-10-14T06:00:00Z",
        "verification_requested_at": "2026-10-14T06:00:00Z",
        "cabinet_name": "演示内容",
        "compartment_no": "1"
      },
      "missing_items": []
    },
    "operation": "R02"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/return/address",
    "method": "POST",
    "status": 200,
    "schema": "ReturnView",
    "sample": {
      "return_id": "demo-return",
      "order_id": "demo-order",
      "method": "EXPRESS",
      "address_version": "1",
      "address": {
        "recipient_name": "演示内容",
        "country_code": "1",
        "phone": "1",
        "region_ids": [
          "演示内容"
        ],
        "region_text": "演示内容",
        "detail": "演示内容",
        "source_id": "demo-source"
      },
      "confirmed_address_version": "1",
      "tracking_no": "演示内容",
      "carrier": "演示内容",
      "shipped_at": "2026-10-14T06:00:00Z",
      "material_status": "INCOMPLETE",
      "submitted_at": "2026-10-14T06:00:00Z",
      "received_at": "2026-10-14T06:00:00Z",
      "receipt_source": "CABINET",
      "receipt_recorded_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "receipt_note": "演示内容",
      "note": "演示内容",
      "evidence_version": "1",
      "evidence_template": {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容",
              "url": "演示内容",
              "poster_url": "演示内容"
            }
          }
        ]
      },
      "evidence_slots": [],
      "evidence_history": [],
      "pre_return_complete": false,
      "cabinet_task": {
        "task_id": "demo-task",
        "order_id": "demo-order",
        "purpose": "PICKUP",
        "cabinet_id": "demo-cabinet",
        "compartment_id": "demo-compartment",
        "status": "RESERVED",
        "door_status": "OPEN",
        "rfid_result": "MATCH",
        "observed_at": "2026-10-14T06:00:00Z",
        "hold_expires_at": "2026-10-14T06:00:00Z",
        "confirmed_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "occupancy_result": "TARGET_PRESENT",
        "pre_open_rfid_result": "MATCH",
        "pre_open_observed_at": "2026-10-14T06:00:00Z",
        "verification_requested_at": "2026-10-14T06:00:00Z",
        "cabinet_name": "演示内容",
        "compartment_no": "1"
      },
      "missing_items": []
    },
    "operation": "R03"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/return/shipment",
    "method": "POST",
    "status": 200,
    "schema": "ReturnView",
    "sample": {
      "return_id": "demo-return",
      "order_id": "demo-order",
      "method": "EXPRESS",
      "address_version": "1",
      "address": {
        "recipient_name": "演示内容",
        "country_code": "1",
        "phone": "1",
        "region_ids": [
          "演示内容"
        ],
        "region_text": "演示内容",
        "detail": "演示内容",
        "source_id": "demo-source"
      },
      "confirmed_address_version": "1",
      "tracking_no": "演示内容",
      "carrier": "演示内容",
      "shipped_at": "2026-10-14T06:00:00Z",
      "material_status": "INCOMPLETE",
      "submitted_at": "2026-10-14T06:00:00Z",
      "received_at": "2026-10-14T06:00:00Z",
      "receipt_source": "CABINET",
      "receipt_recorded_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "receipt_note": "演示内容",
      "note": "演示内容",
      "evidence_version": "1",
      "evidence_template": {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容",
              "url": "演示内容",
              "poster_url": "演示内容"
            }
          }
        ]
      },
      "evidence_slots": [],
      "evidence_history": [],
      "pre_return_complete": false,
      "cabinet_task": {
        "task_id": "demo-task",
        "order_id": "demo-order",
        "purpose": "PICKUP",
        "cabinet_id": "demo-cabinet",
        "compartment_id": "demo-compartment",
        "status": "RESERVED",
        "door_status": "OPEN",
        "rfid_result": "MATCH",
        "observed_at": "2026-10-14T06:00:00Z",
        "hold_expires_at": "2026-10-14T06:00:00Z",
        "confirmed_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "occupancy_result": "TARGET_PRESENT",
        "pre_open_rfid_result": "MATCH",
        "pre_open_observed_at": "2026-10-14T06:00:00Z",
        "verification_requested_at": "2026-10-14T06:00:00Z",
        "cabinet_name": "演示内容",
        "compartment_no": "1"
      },
      "missing_items": []
    },
    "operation": "R04"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/return/shipment/corrections",
    "method": "POST",
    "status": 200,
    "schema": "ReturnView",
    "sample": {
      "return_id": "demo-return",
      "order_id": "demo-order",
      "method": "EXPRESS",
      "address_version": "1",
      "address": {
        "recipient_name": "演示内容",
        "country_code": "1",
        "phone": "1",
        "region_ids": [
          "演示内容"
        ],
        "region_text": "演示内容",
        "detail": "演示内容",
        "source_id": "demo-source"
      },
      "confirmed_address_version": "1",
      "tracking_no": "演示内容",
      "carrier": "演示内容",
      "shipped_at": "2026-10-14T06:00:00Z",
      "material_status": "INCOMPLETE",
      "submitted_at": "2026-10-14T06:00:00Z",
      "received_at": "2026-10-14T06:00:00Z",
      "receipt_source": "CABINET",
      "receipt_recorded_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "receipt_note": "演示内容",
      "note": "演示内容",
      "evidence_version": "1",
      "evidence_template": {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容",
              "url": "演示内容",
              "poster_url": "演示内容"
            }
          }
        ]
      },
      "evidence_slots": [],
      "evidence_history": [],
      "pre_return_complete": false,
      "cabinet_task": {
        "task_id": "demo-task",
        "order_id": "demo-order",
        "purpose": "PICKUP",
        "cabinet_id": "demo-cabinet",
        "compartment_id": "demo-compartment",
        "status": "RESERVED",
        "door_status": "OPEN",
        "rfid_result": "MATCH",
        "observed_at": "2026-10-14T06:00:00Z",
        "hold_expires_at": "2026-10-14T06:00:00Z",
        "confirmed_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "occupancy_result": "TARGET_PRESENT",
        "pre_open_rfid_result": "MATCH",
        "pre_open_observed_at": "2026-10-14T06:00:00Z",
        "verification_requested_at": "2026-10-14T06:00:00Z",
        "cabinet_name": "演示内容",
        "compartment_no": "1"
      },
      "missing_items": []
    },
    "operation": "R05"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/return/receipt",
    "method": "POST",
    "status": 200,
    "schema": "ReturnView",
    "sample": {
      "return_id": "demo-return",
      "order_id": "demo-order",
      "method": "EXPRESS",
      "address_version": "1",
      "address": {
        "recipient_name": "演示内容",
        "country_code": "1",
        "phone": "1",
        "region_ids": [
          "演示内容"
        ],
        "region_text": "演示内容",
        "detail": "演示内容",
        "source_id": "demo-source"
      },
      "confirmed_address_version": "1",
      "tracking_no": "演示内容",
      "carrier": "演示内容",
      "shipped_at": "2026-10-14T06:00:00Z",
      "material_status": "INCOMPLETE",
      "submitted_at": "2026-10-14T06:00:00Z",
      "received_at": "2026-10-14T06:00:00Z",
      "receipt_source": "CABINET",
      "receipt_recorded_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "receipt_note": "演示内容",
      "note": "演示内容",
      "evidence_version": "1",
      "evidence_template": {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容",
              "url": "演示内容",
              "poster_url": "演示内容"
            }
          }
        ]
      },
      "evidence_slots": [],
      "evidence_history": [],
      "pre_return_complete": false,
      "cabinet_task": {
        "task_id": "demo-task",
        "order_id": "demo-order",
        "purpose": "PICKUP",
        "cabinet_id": "demo-cabinet",
        "compartment_id": "demo-compartment",
        "status": "RESERVED",
        "door_status": "OPEN",
        "rfid_result": "MATCH",
        "observed_at": "2026-10-14T06:00:00Z",
        "hold_expires_at": "2026-10-14T06:00:00Z",
        "confirmed_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "occupancy_result": "TARGET_PRESENT",
        "pre_open_rfid_result": "MATCH",
        "pre_open_observed_at": "2026-10-14T06:00:00Z",
        "verification_requested_at": "2026-10-14T06:00:00Z",
        "cabinet_name": "演示内容",
        "compartment_no": "1"
      },
      "missing_items": []
    },
    "operation": "R08"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/cabinet-options",
    "method": "GET",
    "status": 200,
    "schema": "CabinetOptions",
    "sample": {
      "items": [],
      "next_cursor": "演示内容",
      "has_more": false,
      "blockers": []
    },
    "operation": "K01"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/cabinet-tasks",
    "method": "POST",
    "status": 200,
    "schema": "CabinetTask",
    "sample": {
      "task_id": "demo-task",
      "order_id": "demo-order",
      "purpose": "PICKUP",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "status": "RESERVED",
      "door_status": "OPEN",
      "rfid_result": "MATCH",
      "observed_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "occupancy_result": "TARGET_PRESENT",
      "pre_open_rfid_result": "MATCH",
      "pre_open_observed_at": "2026-10-14T06:00:00Z",
      "verification_requested_at": "2026-10-14T06:00:00Z",
      "cabinet_name": "演示内容",
      "compartment_no": "1"
    },
    "operation": "K02"
  },
  {
    "path": "/v1/me/rental-cabinet-tasks/{task_id}",
    "method": "GET",
    "status": 200,
    "schema": "CabinetTask",
    "sample": {
      "task_id": "demo-task",
      "order_id": "demo-order",
      "purpose": "PICKUP",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "status": "RESERVED",
      "door_status": "OPEN",
      "rfid_result": "MATCH",
      "observed_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "occupancy_result": "TARGET_PRESENT",
      "pre_open_rfid_result": "MATCH",
      "pre_open_observed_at": "2026-10-14T06:00:00Z",
      "verification_requested_at": "2026-10-14T06:00:00Z",
      "cabinet_name": "演示内容",
      "compartment_no": "1"
    },
    "operation": "K03"
  },
  {
    "path": "/v1/me/rental-cabinet-tasks/{task_id}/open",
    "method": "POST",
    "status": 200,
    "schema": "CabinetTask",
    "sample": {
      "task_id": "demo-task",
      "order_id": "demo-order",
      "purpose": "PICKUP",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "status": "RESERVED",
      "door_status": "OPEN",
      "rfid_result": "MATCH",
      "observed_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "occupancy_result": "TARGET_PRESENT",
      "pre_open_rfid_result": "MATCH",
      "pre_open_observed_at": "2026-10-14T06:00:00Z",
      "verification_requested_at": "2026-10-14T06:00:00Z",
      "cabinet_name": "演示内容",
      "compartment_no": "1"
    },
    "operation": "K04"
  },
  {
    "path": "/v1/me/rental-cabinet-tasks/{task_id}/cancel",
    "method": "POST",
    "status": 200,
    "schema": "CabinetTask",
    "sample": {
      "task_id": "demo-task",
      "order_id": "demo-order",
      "purpose": "PICKUP",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "status": "RESERVED",
      "door_status": "OPEN",
      "rfid_result": "MATCH",
      "observed_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "occupancy_result": "TARGET_PRESENT",
      "pre_open_rfid_result": "MATCH",
      "pre_open_observed_at": "2026-10-14T06:00:00Z",
      "verification_requested_at": "2026-10-14T06:00:00Z",
      "cabinet_name": "演示内容",
      "compartment_no": "1"
    },
    "operation": "K05"
  },
  {
    "path": "/v1/me/rental-cabinet-tasks/{task_id}/reconciliation",
    "method": "POST",
    "status": 202,
    "schema": "CommandResult",
    "sample": {
      "state": "ACCEPTED",
      "resource_type": "ORDER",
      "resource_id": "demo-resource",
      "order_id": "demo-order",
      "version": "1",
      "poll_after_seconds": 0,
      "allowed_actions": [],
      "blockers": []
    },
    "operation": "K06"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/pickup-credential",
    "method": "GET",
    "status": 200,
    "schema": "PickupCredential",
    "sample": {
      "order_id": "demo-order",
      "credential_id": "demo-credential",
      "pickup_code": "1",
      "expires_at": null
    },
    "operation": "K07"
  },
  {
    "path": "/v1/me/rental-income",
    "method": "GET",
    "status": 200,
    "schema": "WalletSummary",
    "sample": {
      "booked_income_fen": "1",
      "estimated_income_fen": "1",
      "estimated_order_count": 0,
      "withdrawal_enabled": false,
      "currency": "CNY"
    },
    "operation": "S01"
  },
  {
    "path": "/v1/me/rental-earnings",
    "method": "GET",
    "status": 200,
    "schema": "EarningPage",
    "sample": {
      "items": [],
      "next_cursor": "演示内容",
      "has_more": false,
      "summary": {
        "count": 0,
        "beneficiary_fen": "1",
        "as_of": "2026-10-14T06:00:00Z"
      }
    },
    "operation": "S02"
  },
  {
    "path": "/v1/me/rental-earnings/{earning_id}",
    "method": "GET",
    "status": 200,
    "schema": "EarningView",
    "sample": {
      "earning_id": "demo-earning",
      "order_id": "demo-order",
      "beneficiary_kind": "PERSONAL",
      "rent_fen": "1",
      "overtime_fen": "1",
      "loss_fen": "1",
      "subsidy_fen": "1",
      "beneficiary_fen": "1",
      "platform_fen": "1",
      "posted_at": "2026-10-14T06:00:00Z",
      "currency": "CNY",
      "order_no": "演示内容",
      "asset_title": "演示内容",
      "merchant_id": "demo-merchant",
      "merchant_name": "演示内容"
    },
    "operation": "S03"
  },
  {
    "path": "/v1/me/rental-command-results/lookup",
    "method": "POST",
    "status": 200,
    "schema": "LookupView",
    "sample": {
      "state": "NOT_FOUND",
      "result": {
        "state": "ACCEPTED",
        "resource_type": "ORDER",
        "resource_id": "demo-resource",
        "order_id": "demo-order",
        "version": "1",
        "poll_after_seconds": 0,
        "allowed_actions": [],
        "blockers": []
      },
      "error": {
        "code": "EXPORT_RANGE_TOO_LARGE",
        "message": "演示内容",
        "request_id": "demo-request",
        "details": {
          "errors": [
            {
              "field": "演示内容",
              "reason": "演示内容",
              "rule": "演示内容"
            }
          ]
        }
      },
      "retry_same_request": false
    },
    "operation": "X01N"
  },
  {
    "path": "/v1/cabinet-entry",
    "method": "GET",
    "status": 200,
    "schema": "CabinetEntry",
    "sample": {
      "cabinet_id": "demo-cabinet",
      "name": "演示资料",
      "address": "演示内容",
      "connectivity_status": "ONLINE",
      "pickup_enabled": false,
      "login_required": true
    },
    "operation": "K09"
  },
  {
    "path": "/v1/me/cabinet-pickups",
    "method": "POST",
    "status": 200,
    "schema": "CabinetTask",
    "sample": {
      "task_id": "demo-task",
      "order_id": "demo-order",
      "purpose": "PICKUP",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "status": "RESERVED",
      "door_status": "OPEN",
      "rfid_result": "MATCH",
      "observed_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "occupancy_result": "TARGET_PRESENT",
      "pre_open_rfid_result": "MATCH",
      "pre_open_observed_at": "2026-10-14T06:00:00Z",
      "verification_requested_at": "2026-10-14T06:00:00Z",
      "cabinet_name": "演示内容",
      "compartment_no": "1"
    },
    "operation": "K10"
  },
  {
    "path": "/v1/me/identity/verifications",
    "method": "POST",
    "status": 201,
    "schema": "IdentityVerification",
    "sample": {
      "verification_id": "demo-verification",
      "check_kind": "REAL_NAME",
      "status": "NOT_VERIFIED",
      "can_create_verification": false,
      "verified_at": "2026-10-14T06:00:00Z",
      "valid_until": "2026-10-14T06:00:00Z",
      "version": 1,
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z"
    },
    "operation": "createOwnIdentityVerification"
  },
  {
    "path": "/v1/me/identity/verifications/{verification_id}",
    "method": "GET",
    "status": 200,
    "schema": "IdentityVerification",
    "sample": {
      "verification_id": "demo-verification",
      "check_kind": "REAL_NAME",
      "status": "NOT_VERIFIED",
      "can_create_verification": false,
      "verified_at": "2026-10-14T06:00:00Z",
      "valid_until": "2026-10-14T06:00:00Z",
      "version": 1,
      "created_at": "2026-10-14T06:00:00Z",
      "updated_at": "2026-10-14T06:00:00Z"
    },
    "operation": "getOwnIdentityVerification"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/return/evidence-slots/{slot_key}/items/{item_no}",
    "method": "PUT",
    "status": 200,
    "schema": "ReturnView",
    "sample": {
      "return_id": "demo-return",
      "order_id": "demo-order",
      "method": "EXPRESS",
      "address_version": "1",
      "address": {
        "recipient_name": "演示内容",
        "country_code": "1",
        "phone": "1",
        "region_ids": [
          "演示内容"
        ],
        "region_text": "演示内容",
        "detail": "演示内容",
        "source_id": "demo-source"
      },
      "confirmed_address_version": "1",
      "tracking_no": "演示内容",
      "carrier": "演示内容",
      "shipped_at": "2026-10-14T06:00:00Z",
      "material_status": "INCOMPLETE",
      "submitted_at": "2026-10-14T06:00:00Z",
      "received_at": "2026-10-14T06:00:00Z",
      "receipt_source": "CABINET",
      "receipt_recorded_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "receipt_note": "演示内容",
      "note": "演示内容",
      "evidence_version": "1",
      "evidence_template": {
        "template_key": "演示内容",
        "version": "1",
        "title": "演示资料",
        "slots": [
          {
            "slot_key": "演示内容",
            "title": "演示资料",
            "kind": "PHOTO",
            "stage": "PRE_RETURN",
            "min_count": 1,
            "max_count": 1,
            "instruction": "演示内容",
            "sort_order": 0,
            "example": {
              "object_key": "演示内容",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "mime_type": "image/jpeg",
              "poster_object_key": "演示内容",
              "url": "演示内容",
              "poster_url": "演示内容"
            }
          }
        ]
      },
      "evidence_slots": [],
      "evidence_history": [],
      "pre_return_complete": false,
      "cabinet_task": {
        "task_id": "demo-task",
        "order_id": "demo-order",
        "purpose": "PICKUP",
        "cabinet_id": "demo-cabinet",
        "compartment_id": "demo-compartment",
        "status": "RESERVED",
        "door_status": "OPEN",
        "rfid_result": "MATCH",
        "observed_at": "2026-10-14T06:00:00Z",
        "hold_expires_at": "2026-10-14T06:00:00Z",
        "confirmed_at": "2026-10-14T06:00:00Z",
        "version": "1",
        "allowed_actions": [],
        "blockers": [],
        "occupancy_result": "TARGET_PRESENT",
        "pre_open_rfid_result": "MATCH",
        "pre_open_observed_at": "2026-10-14T06:00:00Z",
        "verification_requested_at": "2026-10-14T06:00:00Z",
        "cabinet_name": "演示内容",
        "compartment_no": "1"
      },
      "missing_items": []
    },
    "operation": "R14"
  },
  {
    "path": "/v1/me/rental-cabinet-tasks/{task_id}/confirm-return",
    "method": "POST",
    "status": 202,
    "schema": "CabinetTask",
    "sample": {
      "task_id": "demo-task",
      "order_id": "demo-order",
      "purpose": "PICKUP",
      "cabinet_id": "demo-cabinet",
      "compartment_id": "demo-compartment",
      "status": "RESERVED",
      "door_status": "OPEN",
      "rfid_result": "MATCH",
      "observed_at": "2026-10-14T06:00:00Z",
      "hold_expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z",
      "version": "1",
      "allowed_actions": [],
      "blockers": [],
      "occupancy_result": "TARGET_PRESENT",
      "pre_open_rfid_result": "MATCH",
      "pre_open_observed_at": "2026-10-14T06:00:00Z",
      "verification_requested_at": "2026-10-14T06:00:00Z",
      "cabinet_name": "演示内容",
      "compartment_no": "1"
    },
    "operation": "K12"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/contract/signature-attempts",
    "method": "POST",
    "status": 200,
    "schema": "SignatureAttempt",
    "sample": {
      "attempt_id": "demo-attempt",
      "client_signature_id": "demo-client_signature",
      "status": "BUILDING",
      "version": "1",
      "preview_artifact_id": "demo-preview_artifact",
      "preview_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "error_code": "演示内容",
      "allowed_actions": [],
      "expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z"
    },
    "operation": "SC01"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/contract/signature-attempts/{client_signature_id}",
    "method": "GET",
    "status": 200,
    "schema": "SignatureAttemptLookup",
    "sample": {
      "state": "FOUND",
      "attempt": {
        "attempt_id": "demo-attempt",
        "client_signature_id": "demo-client_signature",
        "status": "BUILDING",
        "version": "1",
        "preview_artifact_id": "demo-preview_artifact",
        "preview_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "error_code": "演示内容",
        "allowed_actions": [],
        "expires_at": "2026-10-14T06:00:00Z",
        "confirmed_at": "2026-10-14T06:00:00Z"
      },
      "signature_image": {
        "material_id": "demo-material",
        "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "url": "演示内容"
      }
    },
    "operation": "SC02"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/contract/signature-attempts/{client_signature_id}/confirm",
    "method": "POST",
    "status": 200,
    "schema": "SignatureAttempt",
    "sample": {
      "attempt_id": "demo-attempt",
      "client_signature_id": "demo-client_signature",
      "status": "BUILDING",
      "version": "1",
      "preview_artifact_id": "demo-preview_artifact",
      "preview_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "error_code": "演示内容",
      "allowed_actions": [],
      "expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z"
    },
    "operation": "SC03"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/contract/signature-attempts/{client_signature_id}/render-retry",
    "method": "POST",
    "status": 200,
    "schema": "SignatureAttempt",
    "sample": {
      "attempt_id": "demo-attempt",
      "client_signature_id": "demo-client_signature",
      "status": "BUILDING",
      "version": "1",
      "preview_artifact_id": "demo-preview_artifact",
      "preview_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "error_code": "演示内容",
      "allowed_actions": [],
      "expires_at": "2026-10-14T06:00:00Z",
      "confirmed_at": "2026-10-14T06:00:00Z"
    },
    "operation": "SC04"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/contract/artifacts/{artifact_id}",
    "method": "GET",
    "status": 200,
    "schema": "ContractArtifact",
    "sample": {
      "artifact_id": "demo-artifact",
      "document_material_id": "demo-document_material",
      "document_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "document_url": "演示内容",
      "page_count": 1,
      "pages": [
        {
          "page_no": 1,
          "material_id": "demo-material",
          "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "演示内容"
        }
      ],
      "anchor_snapshot_json": [
        {
          "role": "TENANT_MAIN",
          "page_no": 1,
          "x": 0,
          "y": 0,
          "w": 1,
          "h": 1
        }
      ],
      "renderer_version": "1"
    },
    "operation": "SC05"
  },
  {
    "path": "/v1/me/rental-conversations",
    "method": "GET",
    "status": 200,
    "schema": "OrderConversationPage",
    "sample": {
      "items": [],
      "next_cursor": "演示内容",
      "has_more": false,
      "total_unread_count": "1",
      "as_of_at": "2026-10-14T06:00:00Z"
    },
    "operation": "M01"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/conversation",
    "method": "POST",
    "status": 200,
    "schema": "OrderConversation",
    "sample": {
      "conversation_id": "demo-conversation",
      "context_kind": "ORDER",
      "order_id": "demo-order",
      "viewer_role": "TENANT",
      "peer": {
        "account_id": "demo-account",
        "display_name": "演示资料",
        "avatar_url": "演示内容",
        "role": "TENANT"
      },
      "order_summary": {
        "order_id": "demo-order",
        "order_no": "演示内容",
        "asset_title": "演示内容",
        "cover_url": "演示内容",
        "display_status_code": "演示内容",
        "rental_start_at": "2026-10-14T06:00:00Z",
        "rental_end_at": "2026-10-14T06:00:00Z"
      },
      "last_message": {
        "message_id": "demo-message",
        "kind": "TEXT",
        "preview": "演示内容",
        "sender_id": "demo-sender",
        "sent_at": "2026-10-14T06:00:00Z"
      },
      "last_message_at": "2026-10-14T06:00:00Z",
      "read_sequence": "1",
      "unread_count": "1",
      "can_post": false,
      "blocked_reason": "演示内容",
      "version": "1"
    },
    "operation": "M02"
  },
  {
    "path": "/v1/me/rental-conversations/{conversation_id}/messages",
    "method": "GET",
    "status": 200,
    "schema": "OrderMessagePage",
    "sample": {
      "conversation": {
        "conversation_id": "demo-conversation",
        "context_kind": "ORDER",
        "order_id": "demo-order",
        "viewer_role": "TENANT",
        "peer": {
          "account_id": "demo-account",
          "display_name": "演示资料",
          "avatar_url": "演示内容",
          "role": "TENANT"
        },
        "order_summary": {
          "order_id": "demo-order",
          "order_no": "演示内容",
          "asset_title": "演示内容",
          "cover_url": "演示内容",
          "display_status_code": "演示内容",
          "rental_start_at": "2026-10-14T06:00:00Z",
          "rental_end_at": "2026-10-14T06:00:00Z"
        },
        "last_message": {
          "message_id": "demo-message",
          "kind": "TEXT",
          "preview": "演示内容",
          "sender_id": "demo-sender",
          "sent_at": "2026-10-14T06:00:00Z"
        },
        "last_message_at": "2026-10-14T06:00:00Z",
        "read_sequence": "1",
        "unread_count": "1",
        "can_post": false,
        "blocked_reason": "演示内容",
        "version": "1"
      },
      "items": [],
      "has_more": false,
      "next_before_sequence": "1",
      "next_after_sequence": "1",
      "last_sequence": "1"
    },
    "operation": "M03"
  },
  {
    "path": "/v1/me/rental-conversations/{conversation_id}/messages",
    "method": "POST",
    "status": 200,
    "schema": "OrderMessage",
    "sample": {
      "message_id": "demo-message",
      "sequence": "1",
      "client_message_id": "demo-client_message",
      "sender_id": "demo-sender",
      "kind": "TEXT",
      "body": "演示内容",
      "media": {
        "material_id": "demo-material",
        "url": "演示内容",
        "mime_type": "image/png",
        "width": 1,
        "height": 1
      },
      "sent_at": "2026-10-14T06:00:00Z"
    },
    "operation": "M04"
  },
  {
    "path": "/v1/me/rental-conversations/{conversation_id}/message-results/{client_message_id}",
    "method": "GET",
    "status": 200,
    "schema": "OrderMessageLookup",
    "sample": {
      "state": "APPLIED",
      "message": {
        "message_id": "demo-message",
        "sequence": "1",
        "client_message_id": "demo-client_message",
        "sender_id": "demo-sender",
        "kind": "TEXT",
        "body": "演示内容",
        "media": {
          "material_id": "demo-material",
          "url": "演示内容",
          "mime_type": "image/png",
          "width": 1,
          "height": 1
        },
        "sent_at": "2026-10-14T06:00:00Z"
      }
    },
    "operation": "M05"
  },
  {
    "path": "/v1/me/rental-conversations/{conversation_id}/read-cursor",
    "method": "POST",
    "status": 200,
    "schema": "OrderReadCursor",
    "sample": {
      "read_sequence": "1",
      "unread_count": "1"
    },
    "operation": "M06"
  },
  {
    "path": "/v1/me/rental-orders/{order_id}/refunds",
    "method": "GET",
    "status": 200,
    "schema": "RefundHistoryPage",
    "sample": {
      "items": [],
      "next_cursor": "演示内容",
      "has_more": false
    },
    "operation": "ListOwnOrderRefundHistory"
  }
];
