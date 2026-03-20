"""
Test Upload Cancellation Feature for Personal Files
Tests the new DELETE /api/personal-files/upload/{upload_id} endpoint for cleaning up chunked uploads.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
PERSONAL_FILES_PASSWORD = "GenSutSu.1999"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Headers with admin token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestUploadCancellation:
    """Test the new DELETE /api/personal-files/upload/{upload_id} endpoint"""
    
    def test_cancel_nonexistent_upload_returns_success(self, auth_headers):
        """DELETE /api/personal-files/upload/{random_id} should return success (idempotent cleanup)"""
        random_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/personal-files/upload/{random_id}",
            headers=auth_headers
        )
        # Should return success even if upload doesn't exist (idempotent cleanup)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        print(f"PASS: DELETE /api/personal-files/upload/{random_id} returns success=True (idempotent)")
    
    def test_init_upload_then_cancel(self, auth_headers):
        """Initialize a chunked upload, then cancel it - verify cleanup"""
        # Step 1: Initialize upload
        init_data = {
            "filename": "TEST_cancel_test.mp4",
            "total_size": "50000000",  # 50MB
            "folder_id": ""
        }
        init_response = requests.post(
            f"{BASE_URL}/api/personal-files/upload/init",
            data=init_data,
            headers=auth_headers
        )
        assert init_response.status_code == 200, f"Init failed: {init_response.text}"
        upload_id = init_response.json().get("upload_id")
        assert upload_id, "No upload_id returned"
        print(f"PASS: Upload initialized with id={upload_id}")
        
        # Step 2: Upload a chunk (to create actual data)
        chunk_data = b"x" * 1024  # 1KB test chunk
        chunk_response = requests.post(
            f"{BASE_URL}/api/personal-files/upload/chunk",
            data={"upload_id": upload_id, "chunk_index": "0"},
            files={"file": ("chunk_0", chunk_data)},
            headers=auth_headers
        )
        assert chunk_response.status_code == 200, f"Chunk upload failed: {chunk_response.text}"
        print(f"PASS: Chunk 0 uploaded successfully")
        
        # Step 3: Cancel the upload
        cancel_response = requests.delete(
            f"{BASE_URL}/api/personal-files/upload/{upload_id}",
            headers=auth_headers
        )
        assert cancel_response.status_code == 200
        data = cancel_response.json()
        assert data.get("success") is True
        print(f"PASS: Upload cancelled successfully")
        
        # Step 4: Verify upload session is gone (trying to upload another chunk should fail)
        chunk2_response = requests.post(
            f"{BASE_URL}/api/personal-files/upload/chunk",
            data={"upload_id": upload_id, "chunk_index": "1"},
            files={"file": ("chunk_1", chunk_data)},
            headers=auth_headers
        )
        assert chunk2_response.status_code == 404, f"Expected 404 after cancel, got {chunk2_response.status_code}"
        print(f"PASS: Upload session properly cleaned up (chunk upload returns 404)")
    
    def test_cancel_requires_admin_auth(self):
        """DELETE /api/personal-files/upload/{id} requires admin authentication"""
        random_id = str(uuid.uuid4())
        
        # Without auth
        response = requests.delete(f"{BASE_URL}/api/personal-files/upload/{random_id}")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: Cancel endpoint requires authentication (returns {response.status_code})")
    
    def test_cancel_with_non_admin_user_fails(self, admin_token):
        """Non-admin users cannot cancel uploads"""
        # First create a regular user
        test_email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register user
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "Test User"
        })
        
        if register_response.status_code == 200:
            user_token = register_response.json().get("token")
            
            # Try to cancel with non-admin token
            random_id = str(uuid.uuid4())
            cancel_response = requests.delete(
                f"{BASE_URL}/api/personal-files/upload/{random_id}",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            assert cancel_response.status_code == 403, f"Expected 403 for non-admin, got {cancel_response.status_code}"
            print(f"PASS: Non-admin user cannot cancel uploads (returns 403)")
            
            # Cleanup: delete test user
            requests.delete(
                f"{BASE_URL}/api/admin/users/{test_email}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        else:
            print(f"SKIP: Could not create test user for non-admin test")


class TestSpriteEndpointsForExistingVideos:
    """Verify sprite endpoints work for videos with sprite_ready=True"""
    
    # Known video IDs with sprites from iteration_51
    TEST_VIDEO_SIMPLE = "dd417d50-1b8f-443f-b97e-6db910a664a0"
    TEST_VIDEO_CHUNKED = "bdddade5-95ea-432d-b75b-bbb7929b494d"
    
    def test_sprite_jpg_returns_200_for_simple_upload_video(self, admin_token):
        """GET /api/personal-files/sprites/{id}/sprite.jpg returns 200 for video with sprites"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{self.TEST_VIDEO_SIMPLE}/sprite.jpg",
            params={"token": admin_token}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "image" in response.headers.get("content-type", ""), "Expected image content type"
        print(f"PASS: Sprite JPG returns 200 for simple upload video")
    
    def test_sprite_vtt_returns_200_for_simple_upload_video(self, admin_token):
        """GET /api/personal-files/sprites/{id}/thumbs.vtt returns 200 for video with sprites"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{self.TEST_VIDEO_SIMPLE}/thumbs.vtt",
            params={"token": admin_token}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "WEBVTT" in response.text, "Expected WEBVTT content"
        print(f"PASS: Sprite VTT returns 200 for simple upload video")
    
    def test_sprite_jpg_returns_200_for_chunked_upload_video(self, admin_token):
        """GET /api/personal-files/sprites/{id}/sprite.jpg returns 200 for chunked upload video"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{self.TEST_VIDEO_CHUNKED}/sprite.jpg",
            params={"token": admin_token}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "image" in response.headers.get("content-type", ""), "Expected image content type"
        print(f"PASS: Sprite JPG returns 200 for chunked upload video")
    
    def test_sprite_vtt_returns_200_for_chunked_upload_video(self, admin_token):
        """GET /api/personal-files/sprites/{id}/thumbs.vtt returns 200 for chunked upload video"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{self.TEST_VIDEO_CHUNKED}/thumbs.vtt",
            params={"token": admin_token}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "WEBVTT" in response.text, "Expected WEBVTT content"
        print(f"PASS: Sprite VTT returns 200 for chunked upload video")
